#!/usr/bin/env bash
# Fills the Errors page with a few clear groups. Run after prepare.cjs cleared it. Not the payments page: the walkthrough makes that group live.
BASE="${BASE:-http://127.0.0.1:8088}"
hit() { curl -s -o /dev/null -m 60 "$BASE$1"; }
for i in 1 2 3; do
	hit "/errors/throw.bxm?type=app"; hit "/errors/throw.bxm?type=sql"; hit "/errors/throw.bxm?type=npe"; hit /query-error.bxm; hit /http-failures.bxm
done
hit "/ai.bxm?action=run&agent=FlakyReporter"; hit "/ai.bxm?action=run&agent=FlakyReporter"; hit "/ai.bxm?action=run&agent=FlakyReporter"
