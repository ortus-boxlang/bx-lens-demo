# The walkthrough video

An 11 to 13 minute video of the demo, in acts: the BxLens bar, the console at a glance, every part of a request (also a ColdBox one), the problem pages, logs, the machine, the JVM, AI observability, Lensy, many servers, and the three tickets. It ends on a full screen bxlens.boxlang.io card with the bxAudio credit. The voice and the music are made with [bx-audio](https://bxaudio.boxlang.io) (a Piper voice and the synthwave piece). The screen is recorded in a headless browser, so the same video can be built again after the demo or the narration changes.

## How it works

All the tools are BoxLang scripts (`.bxs`) and classes (`.bx`), with [bx-playwright](https://bxplaywright.boxlang.io) driving the browser. The only JavaScript is what runs inside the page (see `browser/`).

1. `speak.bxs` speaks every segment of `narration.json` with bx-audio, one WAV per segment, so the length of each is known.
2. `record.bxs` drives the browser through the demo, segment by segment, with a visible cursor. It holds each picture until its sentences are spoken and writes `timeline.json` with the time each segment really started. The picture is a screencast: Chrome stamps every frame with the real time it was shown, so the picture cannot drift from the narration.
3. `mix.bxs` builds the video from the frames, loops the music to the length, masters to -14 LUFS and writes the captions. With a voice it places the voice and ducks the music under it. Without one (`VOICE=0`) the narration is the caption strip, with an act marker, progress dots and the animated opening and closing slides.

| File | What it is |
|---|---|
| `narration.json` | The voice, its speed and pauses, the words of every segment, and the act cards |
| `record.bxs` | What happens on screen in each segment |
| `lib/Recorder.bx` | The browser, the screencast, the cursor, the title cards and the helpers (glide, pick, tab, nav, and so on) |
| `lib/Graphics.bx`, `graphics/` | The caption strip of every act and the two animated slides (HTML pages, drawn with bx-playwright) |
| `lib/Shell.bx` | Runs ffmpeg and ffprobe with a list of arguments, no shell |
| `browser/overlay.js`, `browser/tidy.js` | The code that runs inside the page: the cursor, ripple, cards and credit, and what is hidden because it belongs to the recording machine |
| `warmup.sh`, `prepare.bxs`, `errors.sh` | Put data in the demo before recording: traffic, agent runs, mock servers, and a clean list of errors |
| `accents.json` | The key terms that get the accent color in the captions |
| `mix.bxs`, `build.sh` | The mix, and everything in one command |

## Build it

You need the demo running with **BoxLang+** (the AI page, request cost and the server selector are Plus), ffmpeg, a Chromium, and BoxLang with the `bx-audio` and `bx-playwright` modules.

```bash
install-bx-module bx-audio bx-playwright
cd video
BASE=http://127.0.0.1:8088 CHROMIUM=/path/to/chrome OUT=out ./build.sh
```

`CHROMIUM` points at a Chromium binary. Without it bx-playwright uses the browser it installed (`bxplaywright install chromium`). The result is `out/bxlens-demo-walkthrough.mp4`, the `.srt` captions, a poster and `credits.txt`.

Without the voice-over: `VOICE=0 OUT=out boxlang mix.bxs` after a build writes `bxlens-demo-walkthrough-captions.mp4`, the same picture with the music only and the narration as styled captions (the spoken segments are still used for the timing). When only the captions or the slides change, `REUSE=1` keeps the picture of the last run and encodes faster, and `STRIPS_ONLY=1` also keeps the slides.

## Lensy in the video

There is no model in the recording environment, so Lensy runs on bx-ai's **mock provider** (`ai.provider` is `mock` in the BxLens settings of the recording server). The answers are scripted, the tools are real: Lensy calls `diagnose`, `errors`, `executors`, `requests` and `requestDetail` on the live server. `lensy-script.json` holds the scripts, chosen by a word of the question. The mock provider has no script by itself, so the recording server has a small change in `bx-ai/models/providers/MockService.bx` (`nextScriptedResponse` reads `/srv/demo/lensy-script.json`, counts the tool results since the last question to find the step, and replaces `$id` in a call by the first request id of the last tool result). That change is not part of this repository. The video says on screen that the answers are scripted.

## Changing it

* **The words or the voice**: edit `narration.json` and run `build.sh` again. The recording follows the length of the voice, so it is recorded again too.
* **What is on screen**: edit the function of the segment in `record.bxs`. `SHOTS=1 ONLY=11-requests boxlang record.bxs` runs one segment and saves a screenshot instead of a video, for checking a selector.
* **Another voice**: any single speaker voice of bx-audio (`bx-audio voices`). Check its license: some ask for a credit line, and some are not for marketing.
* **The music**: `boxlang module:bxaudio render <piece> --out=out/music.wav`, then `build.sh` skips rendering when `out/music.wav` is there.

## Notes

* The artwork in `assets/` is the official bxAudio logo from the ortus-artwork repository.
* The video is recorded at 1920 by 1080. `browser/tidy.js` hides what belongs to the recording machine and not to the demo: the trial banner and pill, the mounts of the machine, and the physical disks of the System page. It also shows the home folder as `~/` and drops the kernel build name.
* The console redraws its lists every second, so rows are clicked with `pick`, which clicks the element itself. Selectors use `:visible` because the console keeps every page in the document.
