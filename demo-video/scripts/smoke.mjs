import {generated, media, probe, run, out} from './common.mjs';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {capture} from './capture.mjs';
import {render} from './render.mjs';

const server = createServer((_, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end('<html lang="zh"><title>视频环境自检</title><body style="background:#102535;color:#67e8f9;font:48px Arial;padding:80px"><h1>SciExchange</h1><p>Playwright 录屏测试 / 非实验数据</p></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  await capture(`http://127.0.0.1:${server.address().port}`, 2, {width: 1280, height: 720});
  run(media.ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ar', '48000', '-ac', '1', path.join(generated, 'smoke-tone.wav')], {stdio: 'pipe'});
  const output = await render({title: '视频环境自检通过', footage: 'generated/capture.mp4', audio: 'generated/smoke-tone.wav'});
  const result = probe(output);
  const video = result.streams.find(s => s.codec_type === 'video');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.r_frame_rate, '30/1');
  assert.equal(Number(video.nb_frames), 90);
  assert.ok(result.streams.some(s => s.codec_type === 'audio'));
  assert.ok(Math.abs(Number(result.format.duration) - 3) < 0.15);
  await writeFile(path.join(out, 'smoke-result.json'), JSON.stringify({passed: true, tts: 'BLOCKED: wrapped .msvc voice-conversion model, not synthesized', media: result}, null, 2));
  console.log('PASS: Chromium recording → FFmpeg conversion → Remotion 1080p H.264 + audio. TTS remains unconfigured.');
} finally {
  server.close();
}
