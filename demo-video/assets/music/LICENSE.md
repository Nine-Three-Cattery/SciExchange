# Music provenance

## Current supplied MP3

The latest production uses the MP3 explicitly supplied by the user:
`大越香里 - 桃の節句と艦娘(1).mp3` (supplied locally via `BGM_SOURCE`).
Title and artist from the supplied file: **桃の節句と艦娘 — 大越香里**.
The source is copied into the ignored local music directory and is not modified.
The exact SHA-256 and decoded duration are recorded in
`public/generated/production/music/supplied-bgm.json`.

This is a user-provided recording used at their request. No independent license
verification or public-domain status is claimed. No external recording was
downloaded. Embedded artwork and source metadata are excluded from derivatives.
The recording receives a four-second fade-in, eight-second fade-out and a
four-second equal-power crossfade into a repeat to cover the 229-second video.
Stereo sidechain compression, music-only speech-band EQ and a smooth protective
gain envelope keep the narration in front. The previous score rendition is not
used in the latest mix.

## Previous sheet-based soundtrack

The previous production used a **new synthesized piano rendition** transcribed
from the sheet-music image supplied by the user on 23 October 2026:
`截屏2026-10-23 上午1.25.22.png` (supplied locally via `SCORE_SOURCE`).

Composition: **Merry Christmas, Mr. Lawrence**. Composer: **Ryuichi Sakamoto**.
The arrangement selects measures 1–16 and 18–33 of the provided page, repeats
the opening/theme passages, and adds a final cadence to fit the 229-second video.
It is a manual transcription and background arrangement, not a critical score
edition or the commercial master recording. No commercial audio was downloaded.

`from_score.py` records the source image hash, pitches, hand assignments,
durations, section layout and editable MIDI in
`public/generated/production/music/score-performance.json` and `.mid`.
`render_piano.swift` renders the notes offline using macOS's built-in Acoustic
Grand Piano instrument and subtle reverb. Implementation reference:
[Apple's offline audio rendering documentation](https://developer.apple.com/documentation/avfaudio/performing-offline-audio-processing).

The underlying composition is not asserted to be public domain or CC0; no
independent license verification is claimed. The user supplied this score and
explicitly requested its use. The previous original procedural score is retained
as a historical generated asset but is not used in the current video.

Voice provenance is separate: GPT-SoVITS-v5turbo conditions synthesis on the
user-selected KYOU-0/Ace-Taffy-voice dataset. Reference source, revision and
dataset-declared MIT metadata remain in the local voice manifest.
