#!/usr/bin/env bash
# Avatar maker service for ftc-embeds.com (code in avatar/service).
#   scripts/avatars.sh install   (re)build and start the container, then route /api/avatar/ to it
#   scripts/avatars.sh logs      follow its log (one line per request: no images, no IP addresses)
#   scripts/avatars.sh remove    remove the route and stop the container
# Needs the ./extra mount on ftc-embeds-web (deploy/docker-compose.yml), deployed by scripts/deploy.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-ftc-embeds-server}"
DIR="${DEPLOY_DIR:-/opt/ftc-embeds}"

case "${1:-}" in
install)
    ssh "$HOST" "mkdir -p $DIR/avatars $DIR/extra"
    rsync -az --delete --chmod=D755,F644 --exclude __pycache__ --exclude tests avatar/service/ "$HOST:$DIR/avatars/"
    ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR/avatars && sudo docker compose up -d --build --quiet-pull
# Route traffic to it only once it answers, as seen from ftc-embeds-web.
ok=""
for i in \$(seq 1 30); do
    if sudo docker exec ftc-embeds-web wget -qO- http://ftc-embeds-avatars:8080/api/avatar/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 1
done
if [ -z "\$ok" ]; then
    echo "ftc-embeds-avatars doesn't answer after 30 s; nothing routed to it. See: sudo docker logs ftc-embeds-avatars" >&2
    exit 1
fi
cp $DIR/avatars/avatars.caddy $DIR/extra/avatars.caddy
if ! sudo docker exec ftc-embeds-web caddy reload --config /etc/caddy/Caddyfile; then
    rm -f $DIR/extra/avatars.caddy
    echo "Caddy refused avatars.caddy, so it was removed again; the old config is still running." >&2
    exit 1
fi
REMOTE
    echo "Avatar service installed on $HOST: https://ftc-embeds.com/avatar"
    ;;
logs)
    ssh -t "$HOST" "sudo docker logs -f --tail 100 ftc-embeds-avatars"
    ;;
remove)
    ssh "$HOST" "rm -f $DIR/extra/avatars.caddy && sudo docker exec ftc-embeds-web caddy reload --config /etc/caddy/Caddyfile && cd $DIR/avatars && sudo docker compose down"
    ;;
*)
    echo "usage: scripts/avatars.sh install|logs|remove" >&2; exit 2
    ;;
esac
