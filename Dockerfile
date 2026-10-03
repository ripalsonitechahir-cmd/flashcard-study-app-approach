# ---- Stage 1: build the React frontend ----
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Node/Express API + Prisma, serving the built frontend ----
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/flashcards.db \
    STATIC_DIR=/app/public

# Install deps first (layer caching); prisma schema is needed for postinstall `prisma generate`
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY --from=frontend-build /frontend/dist ./public

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
