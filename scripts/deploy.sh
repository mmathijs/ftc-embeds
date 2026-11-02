#!/usr/bin/env bash
# Builds the site and uploads it to the server. Usage: scripts/deploy.sh [user@host]
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:-${DEPLOY_HOST:-oci@150.136.44.26}}"
# Keys live in the Bitwarden SSH agent when it's running.
if [ -z "${SSH_AUTH_SOCK:-}" ] && [ -S "$HOME/.bitwarden-ssh-agent.sock" ]; then
    export SSH_AUTH_SOCK="$HOME/.bitwarden-ssh-agent.sock"
fi

node scripts/build.mjs
node --test scripts/test.mjs >/dev/null

rsync -az --delete --chmod=D755,F644 dist/site/ "$HOST:/srv/ftc-embeds/site/"
rsync -az deploy/Caddyfile "$HOST:/srv/ftc-embeds/Caddyfile"
ssh "$HOST" 'sudo cp /srv/ftc-embeds/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy'
echo "Deployed to $HOST"
