# ---------- 1. Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# copy package ก่อน (cache dependency)
COPY package*.json ./

RUN npm install

# copy source code ทั้งหมด
COPY . .

# build app
RUN npx prisma generate
RUN npm run build

# ---------- 2. Run Stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# copy เฉพาะของที่จำเป็นจาก builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN mkdir -p /app/public/uploads/Announcements /app/public/uploads/Document /app/public/users
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# ถ้ามี next.config.js
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000

CMD ["npm", "run", "start"]