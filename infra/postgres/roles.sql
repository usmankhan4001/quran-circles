-- Database roles and grants (SEC-12). Run by the `db-roles` one-shot service in
-- infra/docker-compose.prod.yml on every `up`, as the bootstrap superuser `qc`, before `migrate`.
-- Idempotent: it converges a new database, an existing one (all objects owned by `qc`) and a
-- restored one (backups carry no owners or grants) to the same state.
--
--   qc           the image's superuser. Only this script, backups, restores and hand-run psql.
--   qc_migrator  owns the application schema (public) and runs migrations (`migrate`).
--   qc_worker    the worker. Reads and writes the application tables; owns pg-boss's schema,
--                because pg-boss creates queue tables at run time.
--   qc_api       the api. Reads and writes the application tables and sends pg-boss jobs.
-- None of them is a superuser or can create roles or databases, and only qc_migrator can change
-- the application schema. The runtime roles cannot touch `schema_migrations`.
--
-- Passwords come from the container's environment (POSTGRES_MIGRATOR_PASSWORD,
-- POSTGRES_API_PASSWORD, POSTGRES_WORKER_PASSWORD) and are set on every run, so rotating one is:
-- change the env file, then `up -d`. Postgres stores them as SCRAM hashes.

\set ON_ERROR_STOP on
\set QUIET on

\getenv migrator_password POSTGRES_MIGRATOR_PASSWORD
\getenv api_password POSTGRES_API_PASSWORD
\getenv worker_password POSTGRES_WORKER_PASSWORD

\if :{?migrator_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'POSTGRES_MIGRATOR_PASSWORD is not set'; END $$;
\endif
\if :{?api_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'POSTGRES_API_PASSWORD is not set'; END $$;
\endif
\if :{?worker_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'POSTGRES_WORKER_PASSWORD is not set'; END $$;
\endif

SELECT length(:'migrator_password') < 24 OR length(:'api_password') < 24
    OR length(:'worker_password') < 24 AS weak_password \gset
\if :weak_password
DO $$ BEGIN RAISE EXCEPTION 'each POSTGRES_*_PASSWORD needs at least 24 characters'; END $$;
\endif

BEGIN;

-- Roles -------------------------------------------------------------------------------------
SELECT format('CREATE ROLE %I', r)
FROM unnest(ARRAY['qc_migrator', 'qc_api', 'qc_worker']) AS r
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec

ALTER ROLE qc_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'migrator_password';
ALTER ROLE qc_api WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'api_password';
ALTER ROLE qc_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'worker_password';

-- No role inherits another's rights.
SELECT format('REVOKE %I FROM %I', g.rolname, m.rolname)
FROM pg_auth_members am
JOIN pg_roles g ON g.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE m.rolname IN ('qc_migrator', 'qc_api', 'qc_worker') \gexec

-- The database ------------------------------------------------------------------------------
-- Only these roles may connect (the superuser always can). No temporary tables for the runtime
-- roles. qc_worker gets CREATE on the database only while pg-boss is not installed yet: pg-boss's
-- installer runs CREATE SCHEMA, which needs it. The next run takes it away again.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO qc_migrator', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qc_api, qc_worker', current_database()) \gexec
SELECT format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM qc_api', current_database()) \gexec

SELECT to_regclass('pgboss.version') IS NULL AS pgboss_missing \gset
\if :pgboss_missing
SELECT format('GRANT CREATE ON DATABASE %I TO qc_worker', current_database()) \gexec
\else
SELECT format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM qc_worker', current_database()) \gexec
\endif

-- Ownership ---------------------------------------------------------------------------------
-- Hands every object in schema `nsp` that `target` does not own to `target`: tables (partitions
-- included; their indexes and column sequences follow), views, other sequences, types, domains
-- and routines.
CREATE FUNCTION pg_temp.qc_give(nsp text, target text) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS obj, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = nsp AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND pg_get_userbyid(c.relowner) <> target
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO %I',
      CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW'
        WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END, r.obj, target);
  END LOOP;

  FOR r IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = nsp AND c.relkind = 'S' AND pg_get_userbyid(c.relowner) <> target
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
          AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i'))
  LOOP
    EXECUTE format('ALTER SEQUENCE %s OWNER TO %I', r.obj, target);
  END LOOP;

  FOR r IN
    SELECT t.oid::regtype AS obj, t.typtype
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = nsp AND pg_get_userbyid(t.typowner) <> target
      AND (t.typtype IN ('e', 'd', 'r')
        OR (t.typtype = 'c' AND (SELECT relkind FROM pg_class WHERE oid = t.typrelid) = 'c'))
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO %I',
      CASE r.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END, r.obj, target);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS obj
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = nsp AND p.prokind IN ('f', 'p') AND pg_get_userbyid(p.proowner) <> target
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO %I', r.obj, target);
  END LOOP;
END
$fn$;

-- The application schema: qc_migrator creates and owns, the runtime roles read and write.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO qc_migrator;
GRANT USAGE ON SCHEMA public TO qc_api, qc_worker;
REVOKE CREATE ON SCHEMA public FROM qc_api, qc_worker;
SELECT pg_temp.qc_give('public', 'qc_migrator') AS gave_public \gset

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qc_api, qc_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qc_api, qc_worker;
-- Tables and sequences that later migrations create get the same rights.
ALTER DEFAULT PRIVILEGES FOR ROLE qc_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qc_api, qc_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE qc_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO qc_api, qc_worker;
-- The migration ledger is the migrator's alone.
SELECT 'REVOKE ALL ON public.schema_migrations FROM qc_api, qc_worker'
WHERE to_regclass('public.schema_migrations') IS NOT NULL \gexec

-- pg-boss: qc_worker owns the schema (created by pg-boss itself on a new database); the api
-- sends jobs into it. Default privileges cover what qc_worker creates later (the schema itself on
-- a new database, and the queue tables pg-boss adds at run time).
SELECT 'ALTER SCHEMA pgboss OWNER TO qc_worker'
WHERE to_regnamespace('pgboss') IS NOT NULL \gexec
SELECT pg_temp.qc_give('pgboss', 'qc_worker') AS gave_pgboss \gset
SELECT stmt
FROM unnest(ARRAY[
  'GRANT USAGE ON SCHEMA pgboss TO qc_api',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO qc_api',
  'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO qc_api',
  'GRANT EXECUTE ON ALL ROUTINES IN SCHEMA pgboss TO qc_api'
]) AS stmt
WHERE to_regnamespace('pgboss') IS NOT NULL \gexec
ALTER DEFAULT PRIVILEGES FOR ROLE qc_worker GRANT USAGE ON SCHEMAS TO qc_api;
ALTER DEFAULT PRIVILEGES FOR ROLE qc_worker
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qc_api;
ALTER DEFAULT PRIVILEGES FOR ROLE qc_worker GRANT USAGE, SELECT ON SEQUENCES TO qc_api;

COMMIT;

-- Statement statistics ----------------------------------------------------------------------
-- pg_stat_statements is loaded by the server (`shared_preload_libraries` on the postgres service)
-- and counts statements in every database. Its view lives in the maintenance database `postgres`,
-- so the application database, its migrations and its backups do not change. Only `qc` reads it
-- (infra/README.md, "Query statistics"); the runtime roles can connect to `postgres` by default,
-- so they get no access to the view or its functions.
\connect postgres
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
REVOKE ALL ON pg_stat_statements, pg_stat_statements_info FROM PUBLIC;
REVOKE ALL ON FUNCTION pg_stat_statements(boolean), pg_stat_statements_info() FROM PUBLIC;

\echo 'db-roles: qc_migrator, qc_api and qc_worker are up to date'
