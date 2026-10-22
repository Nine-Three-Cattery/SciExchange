import {root, run} from './common.mjs';
import {ensureBrowser} from '@remotion/renderer';
import path from 'node:path';
run(process.execPath, [path.join(root, 'node_modules/playwright/cli.js'), 'install', 'chromium', 'ffmpeg']);
await ensureBrowser();
console.log('Playwright Chromium + recording FFmpeg + Remotion browser ready.');
