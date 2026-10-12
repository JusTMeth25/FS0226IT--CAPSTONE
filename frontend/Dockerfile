# Frontend VinylDex: build di Vite, poi Caddy serve i file statici, passa /api e /ws al backend
# e ottiene da solo il certificato HTTPS (Let's Encrypt) per il dominio.

FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Variabili pubbliche del frontend, lette da Vite alla build (facoltative).
ARG VITE_SPOTIFY_CLIENT_ID=""
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
