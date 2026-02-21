# ── EnterprisePM — Single Docker Image ──
# Builds the React frontend and serves everything from Node.js

# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --production

COPY backend/ ./

# Copy frontend build output from Stage 1
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Create an empty .env file so the settings route can write to it
RUN touch /app/backend/.env

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
