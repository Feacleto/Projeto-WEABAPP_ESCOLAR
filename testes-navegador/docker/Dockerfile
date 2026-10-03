# Os emuladores do Firebase para o teste no navegador.
# Node 22 (o mesmo das functions) + Java 21 (os emuladores de Firestore e
# Storage são Java) + firebase-tools na versão que o projeto usa.
FROM node:22-trixie-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-21-jre-headless ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g firebase-tools@15.15.0 && firebase --version

WORKDIR /app
