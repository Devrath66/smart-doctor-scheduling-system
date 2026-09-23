# DK Hospital Scheduler

A deployable Node.js, Express and MySQL hospital appointment system with transactional conflict prevention and a ranked Smart Scheduler.

## Run locally with Docker

1. Install Docker Desktop.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.

MySQL is initialized automatically from `database/schema.sql`. The database volume persists between runs; use `docker compose down -v` only when you need a clean database.

The sample patient and doctors use the password `password` for local testing. Change or remove these accounts before production deployment.

## Run without Docker

1. Copy `.env.example` to `.env` and set credentials.
2. Run `npm install`.
3. Run `mysql -u root -p < database/schema.sql`.
4. Run `npm start`, then open `http://localhost:3000`.
5. Run `npm test`.

## Host it

The included `Dockerfile` and `render.yaml` support Render. Create a managed MySQL 8 database (PlanetScale, Railway, Aiven, or similar), create a new Render Blueprint from this repository, and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in the web service environment. Run `database/schema.sql` once against that hosted database, then use the Render URL.

Railway and Fly.io can use the same Dockerfile. Set the same environment variables and expose the platform-provided `PORT`; the app responds to `/api/health` for health checks.

Never commit `.env` or production database credentials. Use a long generated `JWT_SECRET`, HTTPS, and a managed database with backups in production.
