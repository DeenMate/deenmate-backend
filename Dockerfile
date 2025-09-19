# syntax=docker/dockerfile:1

# Stage: base deps for backend & admin
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false --legacy-peer-deps
COPY admin-dashboard/package*.json ./admin-dashboard/
RUN cd admin-dashboard && npm ci --production=false

# Stage: build admin and backend
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/admin-dashboard/node_modules ./admin-dashboard/node_modules
COPY . .
# Build admin
WORKDIR /app/admin-dashboard
RUN npm run build
WORKDIR /app
# Build backend
RUN npm run build

# Stage: runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy built backend
COPY --from=builder /app/dist ./dist
# Copy next build output (dist)
COPY --from=builder /app/admin-dashboard/dist ./admin-dashboard/dist
# Copy package/node_modules needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/admin-dashboard/node_modules ./admin-dashboard/node_modules
# Copy other runtime assets (public if used)
COPY --from=builder /app/admin-dashboard/public ./admin-dashboard/public
EXPOSE 3000
CMD ["node", "dist/main.js"]
