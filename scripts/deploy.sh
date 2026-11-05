#!/usr/bin/env bash
# Builds the site and uploads it to the server. Usage: scripts/deploy.sh [ssh host]
# The default host is the "ftc-embeds-server" entry in ~/.ssh/config.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:-${DEPLOY_HOST:-ftc-embeds-server}}"
DIR=/opt/ftc-embeds

node scripts/build.mjs
node scripts/sitemap.mjs
node --test scripts/test.mjs >/dev/null

rsync -az --delete --chmod=D755,F644 dist/site/ "$HOST:$DIR/site/"
# --inplace keeps the same file, which matters for single-file bind mounts like the Caddyfile:
# a replaced file would stay invisible to the running container.
rsync -az --inplace --chmod=F644 deploy/Caddyfile deploy/docker-compose.yml "$HOST:$DIR/"
# Starts the container the first time, recreates it if the compose file changed, and reloads
# its config; the site files themselves are served live.
ssh "$HOST" "cd $DIR && sudo docker compose up -d --quiet-pull && sudo docker exec ftc-embeds-web caddy reload --config /etc/caddy/Caddyfile"
echo "Deployed to $HOST:$DIR"
