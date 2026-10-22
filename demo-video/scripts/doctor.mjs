import {root, media, run} from './common.mjs';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {ensureBrowser} from '@remotion/renderer';
const {chromium} = await import('playwright');
console.log(`Node ${process.version} / ${process.platform} ${process.arch}`);
for (const [tool, executable] of Object.entries(media)) {
  const version = run(executable, ['-version'], {encoding: 'utf8', stdio: 'pipe'}).stdout.split('\n')[0];
  console.log(`${tool}: ${version}\n  ${executable}`);
}
const browser = chromium.executablePath();
console.log(`Playwright Chromium: ${existsSync(browser) ? 'installed' : 'MISSING'} / ${browser}`);
const remotionBrowser = await ensureBrowser();
console.log(`Remotion browser: ${remotionBrowser.path}`);
console.log(`高松灯 model: ${existsSync(path.join(root, '.local/models/高松灯/高松灯.msvc')) ? 'present; wrapped voice-conversion payload' : 'missing'}`);
console.log('Active TTS: GPT-SoVITS-v5turbo + Ace Taffy dataset reference. Run npm run tts:doctor and npm run tts:smoke to check readiness. Legacy .msvc is excluded from this pipeline.');
if (!existsSync(browser)) process.exitCode = 1;
