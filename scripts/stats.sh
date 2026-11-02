#!/usr/bin/env bash
# Embed statistics for ftc-embeds.com.
#   scripts/stats.sh [--days N] [--json]   which sites embed the pit map, and how often
#   scripts/stats.sh install               (re)install logging, the public /stats page and its cron job
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-ftc-embeds-server}"
DIR=/opt/ftc-embeds
CRON="*/10 * * * * python3 $DIR/embed-stats.py --json --days 90 > $DIR/extra/www/stats.json.tmp && mv $DIR/extra/www/stats.json.tmp $DIR/extra/www/stats.json"

case "${1:-}" in
install)
    ssh "$HOST" "mkdir -p $DIR/extra/www"
    rsync -az --chmod=F644 deploy/stats/stats.caddy "$HOST:$DIR/extra/stats.caddy"
    rsync -az --chmod=F644 deploy/stats/stats.html "$HOST:$DIR/extra/www/stats.html"
    rsync -az --chmod=F644 deploy/stats/docker-compose.override.yml deploy/stats/embed-stats.py "$HOST:$DIR/"
    ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR
rm -f extra/stats-users
(crontab -l 2>/dev/null | grep -v "embed-stats.py" || true; echo "$CRON") | crontab -
python3 embed-stats.py --json --days 90 > extra/www/stats.json
sudo docker compose up -d --quiet-pull
sudo docker exec ftc-embeds-web caddy reload --config /etc/caddy/Caddyfile
REMOTE
    echo "Statistics installed on $HOST (page: https://ftc-embeds.com/stats)"
    ;;
*)
    args=$(printf "%q " "$@")
    ssh "$HOST" "python3 $DIR/embed-stats.py $args"
    ;;
esac
