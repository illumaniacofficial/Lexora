# Lexora — Test Credentials

## Admin Console (main app)
- URL: `/login`
- Username: `admin`
- Password: `lexora2026`
- Auto-seeded on server boot via `ensureAdminUser()` in `server/routes.ts`.

## Storefront Readers
- Separate login under `/api/storefront-auth/*`. No default reader seeded; create via admin invite flow.

## Notes
- Session auth via express-session + PostgreSQL (`connect.sid` cookie, Secure/SameSite=None).
- DB: local PostgreSQL, database `lexora`, user `postgres` / password `postgres` (127.0.0.1:5432).
