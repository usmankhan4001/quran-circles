# syntax=docker/dockerfile:1.7
#
# Staging-only image for the in-stack backup and restore check (`restore-check` one-shot in
# infra/docker-compose.staging.yml): the same pinned Postgres image as the stack, plus age.

ARG POSTGRES_IMAGE=postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94

# hadolint ignore=DL3006
FROM ${POSTGRES_IMAGE} AS restore-check-staging

# hadolint ignore=DL3018
RUN apk add --no-cache age
COPY --chmod=755 infra/scripts/staging-restore-check.sh /usr/local/bin/staging-restore-check
USER postgres
CMD ["staging-restore-check"]
