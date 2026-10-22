import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from '@ffprobe-installer/ffprobe';

export const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.local/browsers');
export const generated = path.join(root, 'public/generated');
export const out = path.join(root, 'out');
mkdirSync(generated, {recursive: true});
mkdirSync(out, {recursive: true});
export const media = {ffmpeg: ffmpeg.path, ffprobe: ffprobe.path};

export function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {stdio: 'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(binary)} exited ${result.status}`);
  return result;
}

export function probe(file) {
  return JSON.parse(run(media.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {encoding: 'utf8', stdio: 'pipe'}).stdout);
}
