import {media, run} from './common.mjs';
const [tool, ...args] = process.argv.slice(2);
if (!(tool in media)) throw new Error('Choose ffmpeg or ffprobe');
run(media[tool], args);
