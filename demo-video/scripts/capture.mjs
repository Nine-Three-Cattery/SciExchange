import {generated, out, media, run} from './common.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function capture(url, seconds = 5, {width = 1920, height = 1080} = {}) {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600) throw new Error('Duration must be 1–600 seconds');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Capture requires an HTTP(S) URL');
  const {chromium} = await import('playwright');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, recordVideo: {dir: path.join(out, 'raw'), size: {width, height}}});
    const page = await context.newPage();
    const response = await page.goto(url, {waitUntil: 'load', timeout: 30000});
    if (!response?.ok()) throw new Error(`Capture URL returned ${response?.status() ?? 'no response'}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: path.join(out, 'capture.png')});
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, 'capture.webm'));
  } finally {
    await browser.close();
  }
  const output = path.join(generated, 'capture.mp4');
  run(media.ffmpeg, ['-y', '-i', path.join(out, 'capture.webm'), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', output], {stdio: 'pipe'});
  console.log(`Capture: ${output}`);
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await capture(process.argv[2] ?? 'http://127.0.0.1:5173', Number(process.argv[3] ?? 5));
}
