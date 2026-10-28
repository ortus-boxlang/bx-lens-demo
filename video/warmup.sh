#!/usr/bin/env bash
# Puts data in the demo before the walkthrough is recorded: traffic, errors, agent runs, the mock servers, the investigations.
# Usage: BASE=http://127.0.0.1:8097 ./warmup.sh
set -u
BASE="${BASE:-http://127.0.0.1:8088}"
hit() { curl -s -o /dev/null -m 60 "$BASE$1"; }

echo "traffic"
for i in $(seq 1 12); do
	for p in /orders.bxm /api/orders.json.bxm /api/rates.json.bxm /cache.bxm /n-plus-one.bxm /slow.bxm /query-error.bxm /missing-page.bxm \
		"/errors/throw.bxm?type=app" "/errors/throw.bxm?type=sql" "/errors/throw.bxm?type=npe" /http.bxm /caught-exception.bxm /orders.bxm /orders.bxm; do
		hit "$p"
	done
done

echo "investigations"
for i in 1 2 3; do hit /investigate/checkout.bxm; done
for i in $(seq 1 24); do hit /investigate/payments.bxm & [ $((i % 8)) = 0 ] && wait; done; wait
for i in $(seq 1 40); do hit /investigate/slowdown.bxm; done

echo "agent runs"
for i in $(seq 1 25); do hit "/ai.bxm?action=rounds&n=1"; done

echo "ColdBox app"
hit /cbApp/public/index.bxm/main/health
hit /cbApp/

echo "mock servers"
hit "/fleet.bxm?action=tick"

echo "watchers"
for a in drop edit slow fail burst global; do hit "/watchers.bxm?action=$a"; done
echo done

# What the Errors page shows at the start of the recording: the group list is cleared (prepare.bxs), then these fill it again.
echo "errors for the recording"
