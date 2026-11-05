FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_API_URL=
ARG VITE_NEON_AUTH_URL=
ARG VITE_NEON_REALTIME_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_NEON_AUTH_URL=$VITE_NEON_AUTH_URL
ENV VITE_NEON_REALTIME_URL=$VITE_NEON_REALTIME_URL
RUN npm run build

FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 3000
