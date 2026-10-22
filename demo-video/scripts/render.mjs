import {root, out} from './common.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia} from '@remotion/renderer';

export async function render(inputProps = {}) {
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.tsx'), publicDir: path.join(root, 'public')});
  const composition = await selectComposition({serveUrl, id: 'EnvironmentCheck', inputProps});
  const outputLocation = path.join(out, 'environment-check.mp4');
  await renderMedia({serveUrl, composition, inputProps, outputLocation, codec: 'h264', pixelFormat: 'yuv420p', concurrency: 2, overwrite: true});
  console.log(`Rendered: ${outputLocation}`);
  return outputLocation;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const props = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : {};
  await render(props);
}
