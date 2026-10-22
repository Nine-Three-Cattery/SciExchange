import react from '../../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import {fileURLToPath} from 'node:url';
export default {
  root: fileURLToPath(new URL('../../frontend/', import.meta.url)),
  envDir: fileURLToPath(new URL('../.local/empty-env/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../.local/production-vite/', import.meta.url)),
  plugins: [react()],
  server: {host: '127.0.0.1', port: 5178, strictPort: true, fs: {allow: [fileURLToPath(new URL('../../', import.meta.url))]}},
};
