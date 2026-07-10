# API REST - Endpoints

## Auth

- `GET /v1/auth/microsoft/url`
- `POST /v1/auth/microsoft/callback`

## Catalog / Installation

- `GET /v1/catalog/remote-config`
- `POST /v1/catalog/manifest`

## Launcher content

- `GET /v1/updates/latest?channel=stable|beta`
- `GET /v1/cosmetics/catalog`
- `GET /v1/news`
- `GET /v1/server-status`

## Profiles

- `GET /v1/profiles`
- `POST /v1/profiles`
- `PATCH /v1/profiles/:id`
- `DELETE /v1/profiles/:id`
- `POST /v1/profiles/:id/duplicate`
- `POST /v1/profiles/import`
- `GET /v1/profiles/:id/export`

## Telemetry / Security

- `POST /v1/telemetry/security-events`
- `POST /v1/telemetry/crash-report`
