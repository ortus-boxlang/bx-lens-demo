#!/usr/bin/env bash
# Starts the BxLens demo with an existing BoxLang installation.
#
#   ./start.sh                         install demo modules locally and start on http://localhost:8088
#   ./start.sh activate                activate BoxLang+ (needs BX_LICENSE_EMAIL and BX_LICENSE_KEY), then start as usual
#   WITH_AI=1 ./start.sh               start local Ollama with Docker Compose and turn Lensy on
#   PORT=9000 HOST=0.0.0.0 ./start.sh
#
# Options (all via environment variables):
#   PORT              HTTP port for the demo MiniServer (default 8088)
#   HOST              interface to bind (default 127.0.0.1)
#   RUN_DIR           where generated runtime files live (default ./.run)
#   MOCK_SMTP_PORT    port for the local mock SMTP server (default 2525)
#   WITH_AI=1         start Ollama via Docker Compose and enable Lensy
#   LENS_ACCESS       JSON access mode for the Lens console (default "local")
#   OLLAMA_URL        Ollama endpoint (default http://localhost:11434)
#   OLLAMA_MODEL      Ollama model to use (default LiquidAI/lfm2.5-350m)
#   BX_LICENSE_EMAIL  BoxLang+ email, required by the "activate" subcommand
#   BX_LICENSE_KEY    BoxLang+ license key, required by the "activate" subcommand
#   BX_SERVER_TYPE    BoxLang+ server type for activation (default Development)
set -euo pipefail

# Resolve the repository root regardless of where the script is invoked from.
HERE="$(cd "$(dirname "$0")" && pwd)"
# Runtime settings, all overridable from the environment.
PORT="${PORT:-8088}"
HOST="${HOST:-127.0.0.1}"
RUN="${RUN_DIR:-$HERE/.run}"
SMTP_PORT="${MOCK_SMTP_PORT:-2525}"

# --- Preflight: verify the BoxLang toolchain is available before doing any work ---

# The engine itself is required to run the demo.
if ! command -v boxlang >/dev/null 2>&1; then
	echo "BoxLang is not installed or 'boxlang' is not on PATH." >&2
	echo "Install BoxLang with the Quick Installer or BVM, then rerun ./start.sh." >&2
	exit 1
fi

# install-bx-module ships with BoxLang and installs the demo's modules locally.
if ! command -v install-bx-module >/dev/null 2>&1; then
	echo "The install-bx-module command was not found. Install BoxLang with the Quick Installer or BVM and ensure its bin directory is on PATH." >&2
	exit 1
fi

# --- Install modules ---

# Work from the repo root so relative paths below stay predictable, and make sure
# the runtime directory exists for the generated config, logs and SMTP inbox.
cd "$HERE"
mkdir -p "$RUN"
cd "$HERE/app"
# Install the BoxLang modules the demo pages rely on into ./app/boxlang_modules (local, not global).
echo "+ installing demo modules into ./app/boxlang_modules"
install-bx-module bx-lens,bx-ai,bx-derby,bx-compat-cfml,bx-plus,bx-orm,bx-mail --local

# The ColdBox demo app (app/cbApp) installs ColdBox, TestBox and its modules with bx-cli (BoxLang CommandBox), at the versions pinned in app/cbApp/box.json
# bx-cli is not a dependency of the main demo, so only prompt for it when it is missing.
if ! install-bx-module --list 2>/dev/null | grep -q 'bx-cli' && [ ! -d "$HOME/.boxlang/modules/bx-cli" ]; then
	echo "The ColdBox demo app needs the bx-cli module (BoxLang CommandBox) to install its dependencies."
	read -r -p "Install it now with 'install-bx-module bx-cli'? [y/N] " answer || answer=""
	case "$answer" in
		[yY]*) install-bx-module bx-cli ;;
		*) echo "Skipping bx-cli. The ColdBox demo app (/cbApp/) will not start without app/cbApp/lib." >&2 ;;
	esac
fi
# `box` is the CommandBox CLI; it resolves the pinned dependencies into app/cbApp/lib.
if command -v box >/dev/null 2>&1; then
	echo "+ installing ColdBox demo dependencies into ./app/cbApp/lib"
	(cd "$HERE/app/cbApp" && box install)
fi

# Keep the demo-only module local to this checkout too.
# demoLens lives in ./modules in source control, so re-copy it every run to pick up edits.
mkdir -p "$HERE/app/boxlang_modules"
rm -rf "$HERE/app/boxlang_modules/demoLens"
cp -R "$HERE/modules/demoLens" "$HERE/app/boxlang_modules/demoLens"

# Settings. LENS_ACCESS is a JSON value: "local" (default), or ["local","private"] for a container
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-LiquidAI/lfm2.5-350m}"
# Note the escaped inner quotes: the value is substituted verbatim into the JSON config.
ACCESS="${LENS_ACCESS:-\"local\"}"

# Optional: bring up a local Ollama instance (and pull the model) so Lensy's AI features work.
if [ "${WITH_AI:-}" = "1" ]; then
	if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
		echo "WITH_AI=1 needs Docker with the Compose plugin to run local Ollama. Install Docker, or run Ollama yourself and set OLLAMA_URL." >&2
		exit 1
	fi
	export OLLAMA_MODEL
	echo "+ starting local Ollama with Docker Compose and preparing models (this can take a while the first time)"
	docker compose up -d ollama
	# Waits until the configured model is pulled locally, then exits.
	docker compose run --rm ollama-pull
fi

# --- Generate the runtime config ---
# Copy the template out of ./config (never edit it in place, it is versioned) and fill in
# the @PLACEHOLDER@ tokens with the settings resolved above.
CONFIG_FILE="$RUN/boxlang.json"
cp "$HERE/config/boxlang.json" "$CONFIG_FILE"
sed -i "s|@LENS_ACCESS@|$ACCESS|g; s|@MOCK_SMTP_PORT@|$SMTP_PORT|; s|@LENS_AI_ENABLED@|$([ -n "${WITH_AI:-}" ] && echo true || echo false)|; s|@OLLAMA_URL@|$OLLAMA_URL|g; s|@OLLAMA_MODEL@|$OLLAMA_MODEL|g" "$CONFIG_FILE"

# --- Cleanup on exit ---
# Stop the background SMTP server and remove the generated config, however the script ends.
cleanup() {
	[ -z "${SMTP_PID:-}" ] || kill "$SMTP_PID" 2>/dev/null || true
	rm -f "$CONFIG_FILE"
}
trap cleanup EXIT INT TERM

# --- Optional BoxLang+ activation ---
# `./start.sh activate` activates the license using the credentials from the environment,
# then continues with a normal start. `:?` aborts with a message if a variable is unset.
if [ "${1:-}" = "activate" ]; then
	: "${BX_LICENSE_EMAIL:?set BX_LICENSE_EMAIL}" "${BX_LICENSE_KEY:?set BX_LICENSE_KEY}"
	echo "+ activating BoxLang+ for this demo home"
	boxlang module:plus activate --email "$BX_LICENSE_EMAIL" --licenseKey "$BX_LICENSE_KEY" --serverType "${BX_SERVER_TYPE:-Development}"
	boxlang module:plus info
fi

# --- Mail sink ---
# The SMTP sink for the Mail page: accepts every message, refuses addresses with "reject", delays addresses with "slow"
export MOCK_SMTP_PORT="$SMTP_PORT" MOCK_SMTP_INBOX="$RUN/inbox.log"
# Start from an empty inbox each run, then launch the mock SMTP server in the background.
: > "$MOCK_SMTP_INBOX"
boxlang "$HERE/mock-smtp/smtp.bxs" > "$RUN/smtp.log" 2>&1 &
SMTP_PID=$!

# --- Start the web server ---
echo "+ demo on http://localhost:$PORT. Console: http://localhost:$PORT/~bxlens/index.bxm  password: lens-demo"
# Let /~bxlens/ reach BoxLang: the default pass predicate plus the console path.
export BOXLANG_PASS_PREDICATE='regex( '"'"'^(/.+?\.cfml|/.+?\.cf[cms]|.+?\.bx[ms]{0,1})(/.*)?$'"'"' ) or regex( '"'"'^/~bxlens/?$'"'"' )'
# Prefer the MiniServer; it runs in the foreground so the trap fires when it stops.
if command -v boxlang-miniserver >/dev/null 2>&1; then
	export BOXLANG_DEMO_PORT="$PORT"
	boxlang-miniserver --webroot . --host "$HOST" --port "$PORT" --configPath "$CONFIG_FILE"
else
	echo "MiniServer was not found. Install it with the BoxLang Quick Installer or BVM, then rerun ./start.sh." >&2
	exit 1
fi
