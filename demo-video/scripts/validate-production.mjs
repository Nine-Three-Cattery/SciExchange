import {root, media, probe} from './common.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const destination = path.join(root, 'output');
const movie = path.join(destination, 'SciExchange_OSI_Hackathon_2026.mp4');
const timeline = read('planning/timeline.json');
const measured = read('narration/measured.json');
const captions = read('narration/captions.json');
const processing = read('narration/audio-processing.json');
const suppliedMusic=read('public/generated/production/music/supplied-bgm.json');
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,suppliedMusic.local_copy))).digest('hex'),suppliedMusic.sha256);
assert.equal(suppliedMusic.source_metadata_and_artwork_removed,true);
const recording = read('public/generated/production/recordings-4k/interaction-log.json');
const metadata = probe(movie);
const video = metadata.streams.find(s => s.codec_type === 'video');
const audio = metadata.streams.find(s => s.codec_type === 'audio');
const duration = Number(metadata.format.duration);
assert(metadata.format.format_name.includes('mp4'));
assert.equal(video.codec_name, 'h264');
assert.equal(audio.codec_name, 'aac');
assert.equal(video.width, 3840); assert.equal(video.height, 2160);
assert.equal(video.pix_fmt, 'yuv420p');
assert.equal(video.avg_frame_rate, '30/1');
assert(duration <= 230 && duration < 240);
assert(Math.abs(duration - 229) < 0.05);
assert.equal(Number(video.nb_frames), 6870);
assert.equal(Number(audio.sample_rate), 48000);

// Read top-level MP4 atoms without loading the video into memory.
const atoms = [];
const fd = fs.openSync(movie, 'r');
const bytes = fs.statSync(movie).size;
for (let offset = 0; offset < bytes;) {
  const h = Buffer.alloc(16); fs.readSync(fd, h, 0, 16, offset);
  const size32 = h.readUInt32BE(0);
  const size = size32 === 1 ? Number(h.readBigUInt64BE(8)) : size32 || bytes - offset;
  assert(size >= 8, 'Invalid MP4 atom length');
  atoms.push({type: h.toString('ascii', 4, 8), offset, size}); offset += size;
}
fs.closeSync(fd);
assert(atoms.find(a => a.type === 'moov').offset < atoms.find(a => a.type === 'mdat').offset, 'MP4 requires faststart');

const normalized = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
assert.equal(timeline.length, measured.length);
assert.equal(processing.speed_changes, false);
assert.equal(processing.music_gain_db, 2);
assert(processing.speech_to_music_analysis.minimum_margin_db >= 17.9);
assert.equal(processing.narration_stem_unchanged, true);
assert.equal(processing.music_fades.in_seconds,4);
assert.equal(processing.music_fades.out_seconds,8);
assert.equal(recording.viewport.width,3840);assert.equal(recording.viewport.height,2160);
assert(timeline[0].text.startsWith('Hello everyone. We are Laplace Flower Shop.'));
assert(timeline.at(-1).text.endsWith('Thank you for listening.'));
let nextFrame = 0;
for (const scene of timeline) {
  assert.equal(scene.from, nextFrame); nextFrame += scene.frames;
  const clip = measured.find(m => m.id === scene.id);
  assert.equal(clip.speed_factor, 1);
  assert.equal(clip.engine, 'GPT-SoVITS-v5turbo');
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'public', scene.audio))).digest('hex');
  assert.equal(hash, scene.audioHash); assert.equal(hash, clip.sha256);
  assert.equal(processing.gains.find(g => g.id === scene.id).tempo_factor, 1);
  const cues = captions.filter(c => c.scene === scene.id);
  assert.equal(normalized(cues.map(c => c.text).join(' ')), normalized(scene.text));
  for (const cue of cues) {
    assert(cue.start >= scene.from / 30 && cue.end <= (scene.from + scene.frames) / 30);
    assert(cue.end > cue.start && cue.end - cue.start <= 4.1);
    assert(cue.text.length <= 66);
    for (const word of cue.words) assert(word.start >= cue.start - 0.001 && word.end <= cue.end + 0.001);
  }
}
assert.equal(nextFrame, 6870);
assert.equal(recording.rehearsal, false); assert.equal(recording.mode, 'mock');
assert.deepEqual(recording.errors, []);
const demoScenes = recording.logs.filter(l => l.event === 'scene');
assert.equal(demoScenes.length, 11);
assert(demoScenes.every(s => s.verified));
const footage=read('planning/recording-manifest.json');
for(const scene of demoScenes){
  assert(footage[scene.id].file.includes('/recordings-4k/'));
  const source=probe(path.join(root,'public',footage[scene.id].file)).streams.find(s=>s.codec_type==='video');
  assert.equal(source.width,3840);assert.equal(source.height,2160);
}
assert(fs.statSync(path.join(root, 'public/generated/production/recordings-4k/acquired-demo.csv')).size > 0);
assert.equal((fs.readFileSync(path.join(destination, 'subtitles.srt'), 'utf8').match(/ --> /g) || []).length, captions.length);

// One full decode checks corruption, sustained black frames, and final AAC loudness.
const decoded = spawnSync(media.ffmpeg, ['-hide_banner', '-nostats', '-i', movie,
  '-vf', 'blackdetect=d=0.4:pix_th=0.06', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
  {encoding: 'utf8', maxBuffer: 12 * 1024 * 1024});
fs.writeFileSync(path.join(destination, 'decode-validation.log'), decoded.stderr);
assert.equal(decoded.status, 0, 'Final MP4 did not decode');
const blackIntervals = [...decoded.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)]
  .map(m => ({start: +m[1], end: +m[2], duration: +m[3]}));
assert.equal(blackIntervals.length, 0, 'Review sustained black interval');
const summary = decoded.stderr.slice(decoded.stderr.lastIndexOf('Summary:'));
const integrated = Number(summary.match(/I:\s*([-\d.]+) LUFS/)?.[1]);
const truePeak = Number(summary.match(/Peak:\s*([-\d.]+) dBFS/)?.[1]);
assert(Number.isFinite(integrated) && integrated > -22 && integrated < -12);
assert(Number.isFinite(truePeak) && truePeak < 0);

const qa = path.join(destination, 'qa-final'); fs.mkdirSync(qa, {recursive: true});
for (const [name, time] of [['greeting',3], ['beginning', 8], ['rejection', 80], ['first-approval', 123], ['battery', 164], ['market', 204], ['ending', 222], ['thanks',226]]) {
  const result = spawnSync(media.ffmpeg, ['-v', 'error', '-y', '-ss', String(time), '-i', movie, '-frames:v', '1', path.join(qa, name + '.png')], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
}
const validation = {passed: true, validatedAt: new Date().toISOString(), durationSeconds: duration,
  movieSha256:createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),
  width: video.width, height: video.height, fps: 30, videoCodec: video.codec_name, pixelFormat: video.pix_fmt,
  audioCodec: audio.codec_name, sampleRate: Number(audio.sample_rate), frames: Number(video.nb_frames), bytes,
  faststart: true, atoms, integratedLufs: integrated, truePeakDbfs: truePeak, blackIntervals,
  decodedEntireFile: true, captionCues: captions.length, speechSegments: measured.length,
  speechSpeedFactor: 1, sourceWavHashesVerified: true, verifiedDemoScenes: demoScenes.length,
  recordingPageErrors: recording.errors.length, demoMode: 'mock', extractedFinalFrames: 8,
  musicGainDb: processing.music_gain_db, speechToMusicAnalysis: processing.speech_to_music_analysis,
  musicSource: processing.music_source, musicSourceHash:suppliedMusic.sha256, musicFades:processing.music_fades, narrationStemUnchanged:true,
  demoCaptureResolution:recording.viewport, greetingAndThanks: true};
fs.writeFileSync(path.join(destination, 'validation.json'), JSON.stringify(validation, null, 2) + '\n');
console.log(JSON.stringify(validation, null, 2));
