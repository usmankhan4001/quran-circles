# Infrastructure

Wave 0 only provides the local development database and the baseline checklist for the VPS.
The production stack (WP10) is built by the platform lane in Wave 2, from `docs/agents/briefs/platform.md`.

## Local development

```sh
docker compose -f infra/docker-compose.dev.yml up -d
cp .env.example .env
```

Postgres then listens on `localhost:5432` with the development-only credentials in `.env.example`.

## VPS baseline checklist (human tasks)

These need your access to the server. Agents never receive production credentials.

- [ ] Provider, region, CPU, memory and disk recorded in `docs/engineering/decisions/` (no secrets)
- [ ] Operating system updated and a non-root sudo user created
- [ ] SSH key login only; password login and root login disabled
- [ ] Firewall allows only 22, 80 and 443
- [ ] Automatic security updates enabled
- [ ] Docker Engine and the Compose plugin installed
- [ ] Time zone set to UTC
- [ ] A second location chosen for encrypted backups (another provider or an object store)
- [ ] DNS for the chosen domain points at the server, with a staging subdomain
- [ ] Domain name and app ID decided and written to `docs/engineering/decisions/`
- [ ] Meta Business verification started and the legal owner named
- [ ] Apple Developer, Google Play and Expo accounts confirmed, with the app ID reserved

## Rules

- Secrets live in environment files on the server and in CI secret stores. Never in this repository.
- Production is deployed only through CI.
- `Caddyfile.example` and the Compose files are templates until WP10 replaces them.
