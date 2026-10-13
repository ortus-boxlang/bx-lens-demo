#!/usr/bin/env bash
# Starts the BxLens demo on BoxLang MiniServer.
#
#   ./start.sh                         install bx-lens, start on http://localhost:8085
#   ./start.sh activate                activate BoxLang+ (needs BX_LICENSE_EMAIL and BX_LICENSE_KEY), then start as usual
#   WITH_AI=1 ./start.sh               turn Lensy on, using the Ollama at OLLAMA_URL (default http://localhost:11434)
#   LENS_ZIP=/path/bx-lens.zip ./start.sh   use a module zip you already have (a build or a drop)
#   LENS_VERSION=1.0.0 ./start.sh      install this released version from downloads.ortussolutions.com
#   LENS_LICENSE=trial ./start.sh      show a license state in the console: trial, plus, expired or none
#   PORT=9000 HOST=0.0.0.0 BOXLANG_VERSION=1.19.0-snapshot ./start.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8085}"
HOST="${HOST:-127.0.0.1}"
# bx-lens needs BoxLang 1.19.0 or later. Until 1.19.0 is released this is the snapshot.
VERSION="${BOXLANG_VERSION:-1.19.0-snapshot}"
LENS_VERSION="${LENS_VERSION:-latest}"
CACHE="$HERE/.cache"
RUN="${RUN_DIR:-$HERE/.run}"
DL="https://downloads.ortussolutions.com/ortussolutions"
COMPAT="${BX_COMPAT_VERSION:-1.40.0}"
PLUS_VERSION="${BX_PLUS_VERSION:-1.1.3}"
# bx-orm 1.7.2 or later announces the events BxLens listens to. The snapshot is the bleeding edge build.
ORM_VERSION="${BX_ORM_VERSION:-1.7.2-snapshot}"
# BxLens listens to the onMail events of bx-mail. No release announces them yet: until one does, the Mail page stays empty. BX_MAIL_ZIP=/path/bx-mail.zip uses a build that has them.
MAIL_VERSION="${BX_MAIL_VERSION:-1.4.15}"
SMTP_PORT="${MOCK_SMTP_PORT:-2525}"

mkdir -p "$CACHE" "$RUN"
fetch() { [ -s "$CACHE/$2" ] || { echo "+ downloading $2"; curl -fsSL -o "$CACHE/$2" "$1"; }; }
fetch "$DL/boxlang/$VERSION/boxlang-$VERSION.jar" "boxlang-$VERSION.jar"
fetch "$DL/boxlang-runtimes/boxlang-miniserver/$VERSION/boxlang-miniserver-$VERSION.jar" "miniserver-$VERSION.jar"
fetch "$DL/boxlang-runtimes/boxlang-web-support/$VERSION/boxlang-web-support-$VERSION.jar" "web-support-$VERSION.jar"
fetch "$DL/boxlang-modules/bx-derby/1.0.0/bx-derby-1.0.0.zip" "bx-derby.zip"
fetch "$DL/boxlang-modules/bx-compat-cfml/$COMPAT/bx-compat-cfml-$COMPAT.zip" "bx-compat-cfml-$COMPAT.zip"
fetch "$DL/boxlang-modules/bx-plus/$PLUS_VERSION/bx-plus-$PLUS_VERSION.zip" "bx-plus-$PLUS_VERSION.zip"
fetch "$DL/boxlang-modules/bx-orm/$ORM_VERSION/bx-orm-$ORM_VERSION.zip" "bx-orm-$ORM_VERSION.zip"
[ -n "${BX_MAIL_ZIP:-}" ] || fetch "$DL/boxlang-modules/bx-mail/$MAIL_VERSION/bx-mail-$MAIL_VERSION.zip" "bx-mail-$MAIL_VERSION.zip"

# The BoxLang home keeps its license and logs between starts. Modules and settings are refreshed every time.
HOME_DIR="$RUN/home"
mkdir -p "$HOME_DIR/config" "$HOME_DIR/modules"
for m in derby compat bx-plus bxorm mail bxLens demoLens; do rm -rf "$HOME_DIR/modules/$m"; done
mkdir -p "$HOME_DIR/modules/derby" "$HOME_DIR/modules/compat" "$HOME_DIR/modules/bx-plus" "$HOME_DIR/modules/bxorm" "$HOME_DIR/modules/mail" "$HOME_DIR/modules/bxLens"
unzip -q -o "$CACHE/bx-derby.zip" -d "$HOME_DIR/modules/derby"
unzip -q -o "$CACHE/bx-compat-cfml-$COMPAT.zip" -d "$HOME_DIR/modules/compat"
unzip -q -o "$CACHE/bx-plus-$PLUS_VERSION.zip" -d "$HOME_DIR/modules/bx-plus"
unzip -q -o "$CACHE/bx-orm-$ORM_VERSION.zip" -d "$HOME_DIR/modules/bxorm"
unzip -q -o "${BX_MAIL_ZIP:-$CACHE/bx-mail-$MAIL_VERSION.zip}" -d "$HOME_DIR/modules/mail"
cp -R "$HERE/modules/demoLens" "$HOME_DIR/modules/demoLens"

# bx-lens: a zip you give, or the released module
if [ -n "${LENS_ZIP:-}" ]; then
	unzip -q -o "$LENS_ZIP" -d "$HOME_DIR/modules/bxLens"
else
	if [ "$LENS_VERSION" = "latest" ]; then
		LENS_VERSION="$(curl -fsSL "https://www.forgebox.io/api/v1/entry/bx-lens/latest" 2>/dev/null | sed -n 's/.*"version":"\([0-9.]*\)+.*/\1/p' | head -n 1 || true)"
		[ -n "$LENS_VERSION" ] || { echo "bx-lens is not published on ForgeBox yet. Pass LENS_ZIP=/path/to/bx-lens.zip or LENS_VERSION=x.y.z" >&2; exit 1; }
	fi
	fetch "$DL/boxlang-modules/bx-lens/$LENS_VERSION/bx-lens-$LENS_VERSION.zip" "bx-lens-$LENS_VERSION.zip"
	unzip -q -o "$CACHE/bx-lens-$LENS_VERSION.zip" -d "$HOME_DIR/modules/bxLens"
fi

# Settings. LENS_ACCESS is a JSON value: "local" (default), or ["local","private"] for a container
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
ACCESS="${LENS_ACCESS:-\"local\"}"
cp "$HERE/config/boxlang.json" "$HOME_DIR/config/boxlang.json"
sed -i "s|@LENS_ACCESS@|$ACCESS|g; s|@MOCK_SMTP_PORT@|$SMTP_PORT|; s|@LENS_LICENSE@|${LENS_LICENSE:-}|; s|@LENS_AI_ENABLED@|$([ -n "${WITH_AI:-}" ] && echo true || echo false)|; s|@OLLAMA_URL@|$OLLAMA_URL|; s|@OLLAMA_MODEL@|$OLLAMA_MODEL|" "$HOME_DIR/config/boxlang.json"

export BOXLANG_HOME="$HOME_DIR"
CP="$CACHE/boxlang-$VERSION.jar:$CACHE/miniserver-$VERSION.jar:$CACHE/web-support-$VERSION.jar"

if [ "${1:-}" = "activate" ]; then
	: "${BX_LICENSE_EMAIL:?set BX_LICENSE_EMAIL}" "${BX_LICENSE_KEY:?set BX_LICENSE_KEY}"
	echo "+ activating BoxLang+ for this demo home"
	java -jar "$CACHE/boxlang-$VERSION.jar" module:plus activate --email "$BX_LICENSE_EMAIL" --licenseKey "$BX_LICENSE_KEY" --serverType "${BX_SERVER_TYPE:-Development}"
	java -jar "$CACHE/boxlang-$VERSION.jar" module:plus info
fi

# The SMTP sink for the Mail page: accepts every message, refuses addresses with "reject", delays addresses with "slow"
export MOCK_SMTP_PORT="$SMTP_PORT" MOCK_SMTP_INBOX="$RUN/inbox.log"
: > "$MOCK_SMTP_INBOX"
java -jar "$CACHE/boxlang-$VERSION.jar" "$HERE/mock-smtp/smtp.bxs" > "$RUN/smtp.log" 2>&1 &
SMTP_PID=$!
trap 'kill $SMTP_PID 2>/dev/null || true' EXIT INT TERM

echo "+ demo on http://localhost:$PORT (BoxLang $VERSION). Console: http://localhost:$PORT/~bxlens/index.bxm  password: lens-demo"
# Lets /~bxlens/ reach BoxLang on MiniServer: the default pass predicate plus the console path
export BOXLANG_PASS_PREDICATE='regex( '"'"'^(/.+?\.cfml|/.+?\.cf[cms]|.+?\.bx[ms]{0,1})(/.*)?$'"'"' ) or regex( '"'"'^/~bxlens/?$'"'"' )'
java ${JAVA_OPTS:-} -cp "$CP" ortus.boxlang.web.MiniServer --webroot "$HERE/app" --host "$HOST" --port "$PORT"
