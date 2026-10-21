#!/usr/bin/env bash
# Starts the BxLens demo with an existing BoxLang installation.
#
#   ./start.sh                         install demo modules locally and start on http://localhost:8085
#   ./start.sh activate                activate BoxLang+ (needs BX_LICENSE_EMAIL and BX_LICENSE_KEY), then start as usual
#   WITH_AI=1 ./start.sh               start local Ollama with Docker Compose and turn Lensy on
#   LENS_LICENSE=trial ./start.sh      show a license state in the console: trial, plus, expired or none
#   PORT=9000 HOST=0.0.0.0 ./start.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8085}"
HOST="${HOST:-127.0.0.1}"
RUN="${RUN_DIR:-$HERE/.run}"
SMTP_PORT="${MOCK_SMTP_PORT:-2525}"

if ! command -v boxlang >/dev/null 2>&1; then
	echo "BoxLang is not installed or 'boxlang' is not on PATH." >&2
	echo "Install BoxLang with the Quick Installer or BVM, then rerun ./start.sh." >&2
	exit 1
fi

if ! command -v install-bx-module >/dev/null 2>&1; then
	echo "The install-bx-module command was not found. Install BoxLang with the Quick Installer or BVM and ensure its bin directory is on PATH." >&2
	exit 1
fi

cd "$HERE"
mkdir -p "$RUN"
echo "+ installing demo modules into ./boxlang_modules"
install-bx-module bx-lens,bx-derby,bx-compat-cfml,bx-plus,bx-orm,bx-mail --local

# Keep the demo-only module local to this checkout too.
mkdir -p "$HERE/boxlang_modules"
rm -rf "$HERE/boxlang_modules/demoLens"
cp -R "$HERE/modules/demoLens" "$HERE/boxlang_modules/demoLens"

# Settings. LENS_ACCESS is a JSON value: "local" (default), or ["local","private"] for a container
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
ACCESS="${LENS_ACCESS:-\"local\"}"

if [ "${WITH_AI:-}" = "1" ]; then
	if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
		echo "WITH_AI=1 needs Docker with the Compose plugin to run local Ollama. Install Docker, or run Ollama yourself and set OLLAMA_URL." >&2
		exit 1
	fi
	export OLLAMA_MODEL
	echo "+ starting local Ollama with Docker Compose and preparing models (this can take a while the first time)"
	docker compose up -d ollama
	docker compose run --rm ollama-pull
fi

CONFIG_FILE="$HERE/.boxlang.json"
if [ -e "$CONFIG_FILE" ]; then
	echo "Refusing to overwrite existing $CONFIG_FILE; move it aside and retry." >&2
	exit 1
fi
cp "$HERE/config/boxlang.json" "$CONFIG_FILE"
sed -i "s|@LENS_ACCESS@|$ACCESS|g; s|@MOCK_SMTP_PORT@|$SMTP_PORT|; s|@LENS_LICENSE@|${LENS_LICENSE:-}|; s|@LENS_AI_ENABLED@|$([ -n "${WITH_AI:-}" ] && echo true || echo false)|; s|@OLLAMA_URL@|$OLLAMA_URL|; s|@OLLAMA_MODEL@|$OLLAMA_MODEL|" "$CONFIG_FILE"

cleanup() {
	[ -z "${SMTP_PID:-}" ] || kill "$SMTP_PID" 2>/dev/null || true
	rm -f "$CONFIG_FILE"
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "activate" ]; then
	: "${BX_LICENSE_EMAIL:?set BX_LICENSE_EMAIL}" "${BX_LICENSE_KEY:?set BX_LICENSE_KEY}"
	echo "+ activating BoxLang+ for this demo home"
	boxlang module:plus activate --email "$BX_LICENSE_EMAIL" --licenseKey "$BX_LICENSE_KEY" --serverType "${BX_SERVER_TYPE:-Development}"
	boxlang module:plus info
fi

# The SMTP sink for the Mail page: accepts every message, refuses addresses with "reject", delays addresses with "slow"
export MOCK_SMTP_PORT="$SMTP_PORT" MOCK_SMTP_INBOX="$RUN/inbox.log"
: > "$MOCK_SMTP_INBOX"
boxlang "$HERE/mock-smtp/smtp.bxs" > "$RUN/smtp.log" 2>&1 &
SMTP_PID=$!

echo "+ demo on http://localhost:$PORT. Console: http://localhost:$PORT/~bxlens/index.bxm  password: lens-demo"
# Let /~bxlens/ reach BoxLang: the default pass predicate plus the console path.
export BOXLANG_PASS_PREDICATE='regex( '"'"'^(/.+?\.cfml|/.+?\.cf[cms]|.+?\.bx[ms]{0,1})(/.*)?$'"'"' ) or regex( '"'"'^/~bxlens/?$'"'"' )'
if command -v boxlang-miniserver >/dev/null 2>&1; then
	boxlang-miniserver --webroot "$HERE/app" --host "$HOST" --port "$PORT"
elif command -v bvm >/dev/null 2>&1; then
	bvm miniserver --webroot "$HERE/app" --host "$HOST" --port "$PORT"
else
	echo "MiniServer was not found. Install it with the BoxLang Quick Installer or BVM, then rerun ./start.sh." >&2
	exit 1
fi
