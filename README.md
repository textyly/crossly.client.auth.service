# crossly.client.auth.service

Client authentication for Crossly.

Phase 1 (this version) is deliberately minimal: it issues **anonymous guest sessions** so a user can
start creating patterns immediately, with no login. A guest session is a signed JWT whose `sub` is a
freshly generated client id.

Sessions are valid for **1 year**, and `POST /auth/refresh` re-issues a token for the same client id
with a fresh expiry. The client calls it on use (e.g. on app start) so an active user's session keeps
rolling forward and only lapses after a full year of inactivity.

Later phases add login via existing identity providers (Google, GitHub, …) that issue a token of the
**same shape**, so nothing downstream changes — see the project notes for the staged plan.

## Endpoints

| Method | Route            | Purpose                                                        |
|--------|------------------|---------------------------------------------------------------|
| GET    | `/health`        | Liveness check                                                |
| POST   | `/auth/guest`    | Create a new anonymous guest session                          |
| POST   | `/auth/refresh`  | Re-issue a token for the current session (`Authorization: Bearer <token>`) |
| GET    | `/auth/validate` | Verify a token; on success returns `200` with `X-Client-Id` / `X-Guest` response headers, else `401`. Intended for an API-gateway **ForwardAuth** check so downstream services receive a trusted `clientId` without holding the signing key. |

## Scripts

- `npm run build` — build contracts then the service
- `npm start` — build and run on port 4000
- `npm test` — unit + integration tests
- `npm run test:unit` / `npm run test:integration`

## Configuration

- `AUTH_JWT_SECRET` — HS256 signing secret (defaults to a dev-only value; override in real environments).

## License

Apache-2.0
