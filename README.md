# Flashcard Study App

Create flashcards, study them one at a time, and track which ones you know.

**Stack:** React (Vite) · Node.js/Express · SQLite · Prisma ORM · Docker

## Run with Docker (recommended)

Requires Docker Desktop.

```bash
docker-compose up --build
```

Open **http://localhost:3000**.

- One container serves both the React UI and the API.
- Data is stored in SQLite on the `flashcard-data` Docker volume, so cards survive restarts.
  `docker-compose down -v` wipes it.
- If host port 3000 is taken, pick another: `APP_PORT=3500 docker-compose up --build`
  (PowerShell: `$env:APP_PORT=3500; docker-compose up --build`).

## Run on Kubernetes (Docker Desktop, 1 pod)

Enable Kubernetes in Docker Desktop, then:

```bash
docker build -t flashcard-app:latest .
kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
kubectl -n flashcard get pods
```

Open **http://localhost:30300**. Remove with `kubectl delete ns flashcard`.
SQLite is single-writer, so the Deployment runs exactly one replica (strategy `Recreate`) on a PersistentVolumeClaim.

## Features

- Add / edit / delete cards (front, back, optional deck; no deck = **General**)
- Study mode: show front → reveal back → **Knew it** / **Need practice**
  (cards needing practice come first, then new, then known)
- Stats: total, known, needing practice
- Filter by deck
- Bonus: shuffle in study mode, keyword search, session summary after a study round
- Friendly empty states and error messages

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/cards` | `{front, back, deck?}` → 201 |
| GET | `/cards?deck=&q=` | list, optional deck filter / keyword search |
| PUT | `/cards/:id` | update `front`, `back`, `deck` |
| DELETE | `/cards/:id` | 204 |
| GET | `/study/next?deck=&exclude=1,2&shuffle=true` | 404 if nothing to study |
| POST | `/cards/:id/result` | `{result: "knew" \| "practice"}` |
| GET | `/stats?deck=` | `{total, known, practice, new}` |
| GET | `/decks` | decks with card counts |
| GET | `/health` | health check |

Errors return `{ "error": "message" }` with 400 (empty front/back, invalid result, bad JSON) or 404 (card not found, nothing to study).

## Local development (without Docker)

```bash
# terminal 1 – API on :3000
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev

# terminal 2 – UI on :5173 (proxies API calls to :3000)
cd frontend
npm install
npm run dev
```

Run API tests: `cd backend && npm test`

## CI

`.github/workflows/ci.yml` runs on push to `main`: backend tests, frontend build,
`docker compose build`, then starts the stack and smoke-tests the API and UI.

## Project layout

```
backend/    Express API, Prisma schema + migrations, tests
frontend/   React app (Vite)
Dockerfile  Multi-stage: build React, then run Node serving API + static UI
docker-compose.yml
```
