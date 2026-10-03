# APPROACH.md - Flashcard Study App

**Candidate name:** Ripal Soni
**Project:** 22 - Flashcard Study App
**Date:** 2026-10-03

---

## 1. Problem Approach

**How did you break down the 60-minute timeline?**

| Time | Planned activity | What actually happened |
|------|------------------|------------------------|
| 0-5 min | Read requirements, plan | Read the requirements doc, fixed the stack (React, Node/Express, SQLite, Prisma) and the single-container design |
| 5-25 min | Backend API | Prisma schema + migration, all 7 mandatory endpoints, validation, 8 automated API tests |
| 25-40 min | Web interface | React UI: card form/edit/delete, deck filter, stats, study mode (+ shuffle, search, session summary) |
| 40-50 min | Docker + docker-compose | Multi-stage Dockerfile, compose with a volume; verified by running the real container |
| 50-58 min | GitHub Actions + README | CI workflow (test, build, compose smoke test), README, this file |
| 58-60 min | Final check and push | Re-validated every requirement against the running container (see checklist) |

**What did you prioritize and why?**

The grader runs `docker-compose up`, so a working container came first, and the API/error-handling contract second. The UI stayed plain and simple. Bonus features (shuffle, search, summary) were cheap once the core worked, so I added them last.

---

## 2. Docker Architecture

**Why did you structure your Dockerfiles this way?**

One multi-stage Dockerfile. Stage 1 builds the React app; stage 2 is a slim Node image with only production dependencies, the Express API, Prisma, and the built UI copied in. The build tooling (Vite, dev deps) never reaches the final image.

**Single vs. multi-container - what did you choose?**

Single container. Express serves the static React build and the API on one port (3000), so there is no CORS and no extra service. SQLite is a file on a named volume, so no separate DB container is needed. It is the simplest thing that satisfies "everything runs in Docker Desktop".

**Any Docker optimization considerations?**

- `node:20-bookworm-slim` base (Prisma needs OpenSSL; Debian avoids Alpine/musl engine issues)
- Dependency manifests are copied before source for layer caching
- `.dockerignore` excludes `node_modules`, local DB files, docs
- Runs as the non-root `node` user; `HEALTHCHECK` on `/health`
- DB migrations run on container start (`prisma migrate deploy`); data persists in the `/data` volume

---

## 3. Technical Decisions

**Which framework/language did you choose and why?**

React + Vite (frontend), Node.js + Express (API), SQLite via Prisma (storage). This is the stack I was asked to use. Prisma gives typed queries and versioned migrations, and SQLite keeps everything inside one container.

**How did you structure the application?**

- `backend/src/app.js`: routes, validation, error handling; `server.js` starts it; `db.js` is the Prisma client
- `backend/prisma/`: schema and migration
- `backend/test/`: API tests (Node's built-in test runner against a separate SQLite file)
- `frontend/src/`: `App.jsx` (cards, filters, stats), `CardForm.jsx`, `StudyMode.jsx`, `api.js` (fetch wrapper)
- The frontend calls the API with relative URLs; in dev, Vite proxies them to :3000.

Design choices: cards have a `status` of `new`, `known` or `practice`. "Study next" picks `practice` first, then `new`, then `known`. The client passes `exclude=` ids so a study round doesn't repeat cards and can end with a summary.

---

## 4. CI/CD Implementation

**What does your GitHub Actions workflow do?**

On push to `main`: runs the backend tests, builds the frontend, validates and builds the Docker image via compose, then starts the stack and smoke-tests `/health`, card creation, `/stats`, the served UI, and a 400 on an empty front.

**What would you add with more time?**

Linting, frontend component tests, an end-to-end browser test (Playwright) against the compose stack, image scanning, and pushing the image to a registry.

---

## 5. AI Tool Usage

**How did you use AI tools (GitHub Copilot, ChatGPT, Claude, etc.)?**

Claude Code (in VS Code) generated the implementation from the requirements document, working step by step and running the tests/containers as it went.

**What did AI generate vs. what you wrote?**

AI generated the code, config and docs. I supplied the requirements, the stack choice, and the instruction to confirm any ambiguity before building and to validate against the requirements.

**How did you validate AI-generated code?**

- 8 automated API tests covering CRUD, validation, study ordering, results and stats
- Built the Docker image and exercised the live container with curl (create, empty front → 400, bad result → 400, missing id → 404, stats, UI served)
- Cross-checked each requirement in the Final Checklist below

---

## 6. Challenges & Decisions

**What was the hardest part?**

Environment issues rather than logic. Host port 3000 was already taken by another project's Kubernetes LoadBalancer in Docker Desktop, so the compose host port is configurable (`APP_PORT`, default 3000). Prisma also needs OpenSSL, which drove the Debian-slim base image.

**What trade-offs did you make?**

Single container over a split frontend/backend; SQLite (single-writer, fine for a small internal tool); no auth; plain CSS; no frontend unit tests. Cards that are new are counted separately from "known" and "need practice".

**What would you do differently with more time?**

Add frontend tests and E2E tests, spaced-repetition scheduling, deck management (rename/delete deck), and import/export of cards.

---

## Bonus Items Attempted (if any)

- [x] Kubernetes (k8s/ manifests, 1 replica, NodePort 30300)
- [ ] PostgreSQL
- [ ] Azurite / LocalStack
- [x] Extra feature: shuffle in study mode, keyword search, session summary

**Notes:** SQLite + Prisma was used instead of PostgreSQL, per the requested stack.

---

## Final Checklist

- [x] `docker-compose up` starts the whole app
- [x] App opens at http://localhost:3000 (set `APP_PORT` if that host port is already in use)
- [x] All mandatory API endpoints work
- [x] Error handling covers the listed cases
- [x] `.github/workflows/*.yml` triggers on push to main
- [x] `README.md` has Docker setup instructions
- [x] `.gitignore` is configured
- [ ] Final commit pushed at the 60-minute mark
