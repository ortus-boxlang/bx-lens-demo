#!/usr/bin/env bash
# Requests every page of a running demo and checks the status code.
#   ./test/smoke.sh                       against http://localhost:8088
#   BASE=http://localhost:9000 ./test/smoke.sh
# Pages that fail on purpose must answer 500, all others 200. Needs the real bx-lens module, because the pages call lensMessage() and friends.
BASE="${BASE:-http://localhost:8088}"
fail=0
check() { # expected path
	code="$(curl -s -o /dev/null -m 40 -w '%{http_code}' "$BASE$2")"
	if [ "$code" = "$1" ]; then printf 'ok   %s %s\n' "$code" "$2"; else printf 'FAIL %s (wanted %s) %s\n' "$code" "$1" "$2"; fail=1; fi
}
for p in /index.bxm /orders.bxm /n-plus-one.bxm /slow.bxm /query-error.bxm /caught-exception.bxm /http.bxm /http-loop.bxm /cache.bxm /cache-churn.bxm \
	/timers.bxm /functions.bxm /forms.bxm /session.bxm /transaction.bxm /extend.bxm /xss.bxm /requestid.bxm /api/orders.json.bxm /api/rates.json.bxm \
	/events.bxm /logging.bxm /tasks.bxm /traffic.bxm /errors/index.bxm "/errors/throw.bxm?type=app&caught=1" "/errors/throw.bxm?type=secret&caught=1" \
	/concurrency/deadlock.bxm /concurrency/lock-contention.bxm /concurrency/executors.bxm /runtime/pool-exhaustion.bxm /runtime/memory-leak.bxm \
	/runtime/gc-pressure.bxm /runtime/thread-leak.bxm /runtime/cpu-spin.bxm /orm.bxm /orm.bxm?save=1 /orm.bxm?fail=1 /mail.bxm /mail/send.bxm?scenario=text /mail/send.bxm?scenario=html /mail/send.bxm?scenario=multipart /mail/send.bxm?scenario=fail /mail/failover/send.bxm \
	/legacy/index.cfm /legacy/orders.cfm /legacy/n-plus-one.cfm /legacy/tags.cfm \
	/spans/trycatch.bxm /spans/caught-func.bxm /spans/async.bxm /spans/stream.bxm; do
	check 200 "$p"
done
for p in /error.bxm /legacy/error.cfm /spans/uncaught.bxm "/errors/throw.bxm?type=sql" "/errors/throw.bxm?type=npe"; do
	check 500 "$p"
done
# Scenarios: start, see it running, reset, see it idle
for id in deadlock contention executors pool memory gc threads cpu; do
	curl -s -o /dev/null "$BASE/control.bxm?action=start&id=$id"
	running="$(curl -s "$BASE/index.bxm" | grep -c 'pill on')"
	curl -s -o /dev/null "$BASE/control.bxm?action=reset&id=$id"
	if [ "$running" -ge 1 ]; then printf 'ok   scenario %s started\n' "$id"; else printf 'FAIL scenario %s did not start\n' "$id"; fail=1; fi
done
sleep 2
idle="$(curl -s "$BASE/index.bxm" | grep -c 'pill on')"
if [ "$idle" = "0" ]; then echo "ok   everything reset"; else echo "FAIL $idle scenario(s) still running after reset"; fail=1; fi

# The ColdBox app: every scenario of its catalog must answer the status it says, then its TestBox suite must pass
if curl -s -o /dev/null -m 60 "$BASE/cbApp/public/index.bxm/main/health"; then
	while read -r want path; do
		[ -n "$path" ] && check "$want" "$path"
	done < <(curl -s -m 120 "$BASE/cbApp/public/index.bxm/main/scenariosText")
	summary="$(curl -s -m 600 "$BASE/cbApp/tests/runner.bxm?reporter=text" | grep -m1 'Passed:.*Bundles')"
	if echo "$summary" | grep -q '\[Failed: 0\] \[Errors: 0\]'; then echo "ok   cbApp TestBox $summary"; else echo "FAIL cbApp TestBox: $summary"; fail=1; fi
else
	echo "skip cbApp (not answering)"
fi
exit $fail
