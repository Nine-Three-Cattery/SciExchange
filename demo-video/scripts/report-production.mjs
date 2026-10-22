import {root} from './common.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const v=read('output/validation.json');
const a=read('narration/audio-processing.json');
const source=read('public/generated/production/music/supplied-bgm.json');
const measured=read('narration/measured.json');
const speech=measured.reduce((total,s)=>total+s.duration,0);
const movie=path.join(root,'output/SciExchange_OSI_Hackathon_2026.mp4');
assert(v.passed&&v.width===3840&&v.height===2160);
assert.equal(createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),v.movieSha256);
const report=`# SciExchange — 4K production report

The latest English introduction and actual software demonstration is **${v.durationSeconds} seconds (3:49.013)** at **3840×2160, 30 fps**, below the 230-second production ceiling. The picture timeline is exactly 229 seconds; AAC container padding accounts for approximately 13 milliseconds. This revision replaces the soundtrack with the user's supplied MP3 and re-records the real Demo at 4K. The existing normal-rate narration, greeting, thank-you and synchronized English captions are retained.

## Deliverables

| File | Purpose |
| --- | --- |
| SciExchange_OSI_Hackathon_2026.mp4 | Canonical 4K master, ${v.bytes.toLocaleString('en-US')} bytes (${(v.bytes/1024**2).toFixed(2)} MiB) |
| SciExchange_OSI_Hackathon_2026_v3_4K.mp4 | Identical versioned copy for an unambiguous new preview |
| subtitles.srt | ${v.captionCues} synchronized English subtitle cues |
| thumbnail.png | 3840×2160 cover |
| validation.json | Final MP4 properties, hashes and executed automated checks |
| qa-final/ | Eight representative frames extracted from the final encoded video |
| decode-validation.log | Complete decode, black-frame and final AAC loudness measurements |

Master SHA-256: ${v.movieSha256}.

## Story and actual demonstration

The story is based on docs/presentation/index.html and cross-checked against the existing application and project implementation. It introduces the hidden-evidence problem, numerical screening, provenance, reciprocal exchange and independent human consent. The video explicitly distinguishes screening from a completed Lean proof and preserves uncertainty about experimental authenticity.

Playwright operated the actual React application through its existing mock adapter. The final recording passed **all eleven scene assertions with zero page errors**, covering:

1. Scientific evidence catalog.
2. Flagged OER rejection, including 108.2% reported Faradaic efficiency and an isolated injection warning.
3. Eligible catalysis compilation and attestation/priority inspection.
4. Reciprocal laboratory exchange proposal and agreement review.
5. PI A approved, PI B pending, and data still locked.
6. Second approval and explicitly simulated settlement.
7. Simulated polarization and Tafel plots with units and conditions.
8. Battery retention, differential capacity and an actual range change.
9. Experimental-context and causal-confounder warning.
10. Eligible failure-data deposit and simulated internal SciCredit.
11. Access challenge, simulated purchase, and an actual nonempty fixture CSV download.

The demonstration remains visibly labeled SIMULATED DATA + APPROVALS. It does not represent a live backend, real PI signatures, real payment or live scientific verification. The independent purchase scene uses a fresh mock session, identified onscreen; its loading is cut before the scene. No successful state is fabricated or substituted. No unverified Valency, Marimo or Adaption integration or historical test total is claimed.

There are 155.2 seconds of actual Demo footage. The new source viewport and encoded clips are **3840×2160**, with a display zoom of two for readability. Only display presentation and the pointer indicator are adjusted; application business logic and parent source files remain unchanged. The original demonstration state and all successful results come from the application's own mock adapter. The recording log, source and actual download are in public/generated/production/recordings-4k/.

Motion graphics and typography use Remotion's 2× rendering scale from the existing 1920×1080 logical layout. The video therefore uses newly captured 4K app footage and high-resolution graphics rather than enlarging the previous completed 1080p video. The latest user request supersedes the earlier 1080p output specification in the production instructions.

## Narration and subtitles

The ${measured.length} speech clips total **${speech.toFixed(2)} seconds** and use GPT-SoVITS-v5turbo with the user-selected Ace Taffy reference at **speed_factor=1.0**. The combined narration stem is byte-for-byte unchanged from the previous version, verified by SHA-256: ${a.narration_stem_sha256}. No narration speed, pitch, duration or speech-content changes were made for this revision.

The opening says “Hello everyone. We are Laplace Flower Shop.” The closing says “Thank you for listening.” Both have matching graphics and subtitles. Captions retain word timing from local forced alignment, active-word highlighting, safe margins and at most two lines. All ${v.captionCues} cues have complete normalized script coverage and fit their scene bounds.

Forced alignment verifies script coverage and timing, not perfect pronunciation. Earlier independent ASR checks disagreed with the script on some scientific terms, wording and proper names. The cross-language voice retains its accent; that prior perceptual-review limitation remains. No fresh human listening certification is claimed.

TTS provenance: upstream GPT-SoVITS revision b4570b876f5c086819ba84e3215472733c6a7b70, local CPU FP32 inference. Reference dataset KYOU-0/Ace-Taffy-voice, revision 48623d4de7338a82a83bd9c76a9a4ee193aadb3f, row 1804 / segment 001805. Reference hash 656602e2004c7e64bf56e11930b42a69dd8fc462c2890cef205f618f6a0600f6. Dataset-declared MIT metadata is recorded as provenance, not independent verification of speaker or underlying recording rights.

## Supplied BGM and speech-responsive mixing

Source: **${source.artist} — ${source.title}**, from the local MP3 explicitly supplied by the user. Source SHA-256: ${source.sha256}. The original MP3 was not modified. Its decoded music lasts ${source.decoded_duration_seconds.toFixed(6)} seconds at 48 kHz stereo after sample-rate conversion; music tempo is unchanged. Embedded artwork and original metadata are excluded from derivatives.

The music is extended to the 229-second timeline using a **4-second equal-power loop crossfade**, starting at ${source.loop_joins[0].start_seconds.toFixed(3)} seconds. It has a **4-second fade-in** and **8-second fade-out**. The prepared music bed's silent start/end samples and exact stereo sample count were checked.

The music baseline is normalized to −33 dBFS RMS with a 2 dB gain before ducking. Stereo sidechain compression follows the narration with a 15 ms attack and 500 ms release. A gentle music-only cut around the speech-consonant band and a smooth additional gain cap protect quieter words. The voice remains centered and the BGM retains stereo imaging. Full-mix loudness processing and limiting prevent clipping without changing narration timing.

In 0.4-second windows with voice RMS above −32 dBFS, measured voice-to-music margin is at least **${a.speech_to_music_analysis.minimum_margin_db.toFixed(1)} dB**, median **${a.speech_to_music_analysis.median_margin_db.toFixed(1)} dB**. These are stem-level measurements supporting speech priority; they do not certify perceptual intelligibility of every word. The previous score-based piano rendition is not used in this mix.

The user supplied this recording and explicitly requested this edit. No independent verification of public-use music licensing, public-domain status or CC0 rights is claimed. No music was downloaded from another service. Full source and historical asset notes are in assets/music/LICENSE.md.

## Executed validation

npm run typecheck passed. The completed new 4K Playwright recording passed eleven scene assertions with zero page errors. The downloaded fixture CSV is nonempty. Every prepared Demo clip was probed at 3840×2160. Source MP3 and narration hashes were checked, and the original source MP3 remained unchanged.

npm run video:validate passed against the final encoded MP4:

| Check | Actual result |
| --- | --- |
| Video | H.264, ${v.width}×${v.height}, 30/1 fps, yuv420p |
| Picture frames | ${v.frames.toLocaleString('en-US')} |
| Audio | AAC, ${v.sampleRate} Hz, stereo, 256 kbit/s target |
| Duration | ${v.durationSeconds} seconds |
| Web playback | moov atom before mdat, faststart |
| Full-file decode | Successful |
| Sustained black intervals | None at blackdetect=d=0.4:pix_th=0.06 |
| Integrated loudness | ${v.integratedLufs.toFixed(1)} LUFS |
| True peak | ${v.truePeakDbfs.toFixed(1)} dBFS, no clipping indicated |
| Captions | ${v.captionCues} cues, complete script coverage and bounded timing |
| Narration | All original-rate source WAV hashes verified; combined stem unchanged |

Native 4K Remotion previews of compiler rejection, one-sided approval, battery charts and marketplace success were inspected before rendering. Eight representative frames were extracted from the final MP4 at 0:03, 0:08, 1:20, 2:03, 2:44, 3:24, 3:42 and 3:46 and visually inspected for layout, English text, caption margins, key feedback and simulated-state indicators. These checks are representative visual inspection plus complete automated decoding, not a human frame-by-frame review of every moment.

## Reproduction and workspace safety

All project edits, retained dependencies, models, recorded footage and outputs stay under demo-video/. The supplied external MP3 is read and copied into its ignored local music folder; it is never overwritten. The parent application is read-only and was launched through the isolated Vite config. The temporary recording server was stopped after capture. No teammate-owned implementation, shared dependency lockfile or root configuration was changed. No generated binaries were committed or publicly uploaded, and no competition submission was made.

After the existing dependencies and local TTS assets are prepared, commands from demo-video/ are:

~~~sh
npm run video:music
# Start the isolated demo Vite server as documented in README.md, then:
npm run video:record -- --4k
npm run video:footage -- --4k
npm run typecheck
npm run video:stills
npm run video:render
npm run video:validate
~~~

Primary implementation: remotion/Root.tsx; automation/record.ts; narration/mix_supplied_bgm.py; scripts/render-production.mjs; scripts/validate-production.mjs. The narration and measured timeline remain in narration/ and planning/.
`;
fs.writeFileSync(path.join(root,'output/production-report.md'),report);
console.log('Wrote verified 4K production report.');
