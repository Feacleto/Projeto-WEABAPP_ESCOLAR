#!/bin/sh
# Sobe os emuladores dentro do contêiner.
#
# As dependências das functions são instaladas AQUI, num volume próprio, e não
# reaproveitadas do Windows: o `node_modules` da máquina foi montado para
# Windows e pode trazer binário nativo que o Linux não carrega.
#
# Os dados de teste sobrevivem: entram de `testes-navegador/dados` (se houver)
# e voltam para lá quando o contêiner para (`docker compose stop`).
set -e
cd /app/functions
if [ ! -d node_modules/firebase-functions ]; then
  echo "[teste] instalando as dependências das functions (só na primeira vez)…"
  npm ci --no-audit --no-fund
fi

# A configuração mora na RAIZ (`firebase.teste.json`): o Firebase recusa regras
# fora da pasta do arquivo de configuração.
#
# ⚠️ OS DADOS MORAM NUM VOLUME, NÃO NA PASTA DO WINDOWS. O Firebase monta a
# exportação numa pasta temporária do diretório ATUAL e depois a RENOMEIA para
# o destino — e renomear pasta sobre o bind mount do Windows dá EACCES: a
# exportação ficava largada na raiz do repositório e a próxima subida começava
# vazia. Por isso o diretório de trabalho é o próprio volume (`/dados`).
#
# `testes-navegador/dados` virou SEMENTE: se o volume está vazio e a pasta
# existe, ela é copiada para dentro uma vez.
DADOS=/dados/atual
SEMENTE=/app/testes-navegador/dados
if [ ! -f "$DADOS/firebase-export-metadata.json" ] && [ -f "$SEMENTE/firebase-export-metadata.json" ]; then
  echo "[teste] semeando o volume a partir de $SEMENTE"
  mkdir -p "$DADOS" && cp -r "$SEMENTE"/. "$DADOS"/
fi
IMPORTAR=""
if [ -f "$DADOS/firebase-export-metadata.json" ]; then
  IMPORTAR="--import=$DADOS"
  echo "[teste] retomando os dados de $DADOS"
fi

cd /dados
exec firebase emulators:start   --config /app/firebase.teste.json   --project demo-alobuzinou   --only auth,firestore,functions,storage   $IMPORTAR --export-on-exit="$DADOS"
