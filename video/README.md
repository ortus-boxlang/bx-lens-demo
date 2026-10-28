# The walkthrough video

An 11 to 13 minute video of the demo, in acts: the BxLens bar, the console at a glance, every part of a request (also a ColdBox one), the problem pages, logs, the machine, the JVM, AI observability, Lensy, many servers, and the three tickets. It ends on a full screen bxlens.boxlang.io card with the bxAudio credit. The voice and the music are made with [bx-audio](https://bxaudio.boxlang.io) (a Piper voice and the synthwave piece). The screen is recorded in a headless browser, so the same video can be built again after the demo or the narration changes.

## How it works

1. `speak.bxs` speaks every segment of `narration.json` with bx-audio, one WAV per segment, so the length of each is known.
2. `record.cjs` drives the browser through the demo, segment by segment, with a visible cursor. It holds each picture until its sentences are spoken and writes `timeline.json` with the time each segment really started.
3. `mix.cjs` places the voice where each segment started, loops the music to the length and ducks it under the voice, masters to -14 LUFS, puts it on the picture and writes the captions (`.srt`).

| File | What it is |
|---|---|
| `narration.json` | The voice, its speed and pauses, and the words of every segment |
| `record.cjs` | What happens on screen in each segment |
| `lib.cjs` | The browser, the cursor, the title cards and the helpers |
| `warmup.sh`, `prepare.cjs`, `errors.sh` | Put data in the demo before recording: traffic, agent runs, mock servers, and a clean list of errors |
| `mix.cjs`, `build.sh` | The mix, and everything in one command |

## Build it

You need the demo running with **BoxLang+** (the AI page, request cost and the server selector are Plus), Node.js 20 or newer, ffmpeg, a Chromium, and BoxLang with the `bx-audio` module.

```bash
cd video
npm install playwright
BASE=http://127.0.0.1:8088 CHROMIUM=/path/to/chrome OUT=out ./build.sh
```

The result is `out/bxlens-demo-walkthrough.mp4`, the `.srt` captions, a poster and `credits.txt`.

Without the voice-over: `VOICE=0 OUT=out node mix.cjs` after a build writes `bxlens-demo-walkthrough-captions.mp4`, the same picture with the music only and the narration as captions in a strip under the picture (the spoken segments are still used for the timing).

## Lensy in the video

There is no model in the recording environment, so Lensy runs on bx-ai's **mock provider** (`ai.provider` is `mock` in the BxLens settings of the recording server). The answers are scripted, the tools are real: Lensy calls `diagnose`, `errors`, `executors`, `requests` and `requestDetail` on the live server. `lensy-script.json` holds the scripts, chosen by a word of the question. The mock provider has no script by itself, so the recording server has a small change in `bx-ai/models/providers/MockService.bx` (`nextScriptedResponse` reads `/srv/demo/lensy-script.json`, counts the tool results since the last question to find the step, and replaces `$id` in a call by the first request id of the last tool result). That change is not part of this repository. The video says on screen that the answers are scripted.

## Changing it

* **The words or the voice**: edit `narration.json` and run `build.sh` again. The recording follows the length of the voice, so it is recorded again too.
* **What is on screen**: edit the function of the segment in `record.cjs`. `SHOTS=1 ONLY=11-requests node record.cjs` runs one segment and saves a screenshot instead of a video, for checking a selector.
* **Another voice**: any single speaker voice of bx-audio (`bx-audio voices`). Check its license: some ask for a credit line, and some are not for marketing.
* **The music**: `boxlang module:bxaudio render <piece> --out=out/music.wav`, then `build.sh` skips rendering when `out/music.wav` is there.

## Notes

* The artwork in `assets/` is the official bxAudio logo from the ortus-artwork repository.
* The video is recorded at 1920 by 1080. `lib.cjs` hides two things on screen that belong to the recording machine and not to the demo: the mounts and JVM flags on the System page, and the volume of the first server in the Overview table.
* The console redraws its lists every second, so rows are clicked with `pick`, which clicks the element itself. Selectors use `:visible` because the console keeps every page in the document.
