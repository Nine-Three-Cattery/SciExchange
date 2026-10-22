# Production plan

1. Inspect the supplied HTML and actual implementation; rehearse the existing demo workflow with Playwright.
2. Generate each English narration segment with the installed v5turbo model and Ace Taffy reference at speed_factor=1.0. No atempo, pitch shifting, resampling for duration changes, or speech trimming.
3. Measure audio lengths and allocate the 229-second timeline using pauses; rewrite segments if speech exceeds the ceiling.
4. Force-align the actual WAVs to their authored English transcripts with local Whisper alignment. Export phrase captions and SRT.
5. Record actual application operations at 1920×1080; assert resulting state and record timecoded actions. Retain original mode badges.
6. Compose animated explanatory graphics, UI footage, captions and narration with Remotion. The latest revision uses the user's supplied MP3, with a 4-second equal-power loop crossfade, 4-second fade-in, 8-second fade-out, stereo ducking and quiet-speech protection. Preserve the animated greeting and thank-you ending and unchanged narration.
7. Re-record the actual app at 3840×2160 using display zoom for readable UI; render diagrams and typography at 2× scale. Export H.264/AAC, 4K, 30 fps. Probe media, inspect representative frames, check audio levels and caption bounds. Export video, subtitles, thumbnail and production report. The user's resolution request supersedes the earlier 1080p output specification.
