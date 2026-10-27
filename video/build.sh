#!/usr/bin/env bash
# Builds the walkthrough video of the demo from scratch: voice, music, recording, mix.
# Needs: the demo running (BASE), BoxLang with the bx-audio module, Node.js with Playwright (npm install here), ffmpeg and a Chromium (CHROMIUM).
#   BASE=http://127.0.0.1:8088 CHROMIUM=/path/to/chrome OUT=out ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
export OUT="${OUT:-out}" BASE="${BASE:-http://127.0.0.1:8088}"
mkdir -p "$OUT"

echo "1. voice (bx-audio, the voice is set in narration.json)"
NARRATION="$PWD/narration.json" OUT="$OUT" boxlang speak.bxs

echo "2. music (bx-audio synthwave, 48 bars at 92 bpm)"
[ -s "$OUT/music.wav" ] || boxlang module:bxaudio render synthwave --bars=48 --bpm=92 --out="$OUT/music.wav"

echo "3. data for the console"
./warmup.sh
node prepare.cjs
./errors.sh

echo "4. recording"
node record.cjs

echo "5. mix"
node mix.cjs
