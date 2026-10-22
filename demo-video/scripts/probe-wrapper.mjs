// Bounded compatibility probe using fields already present in the local model.
// No model execution, external uploads or arbitrary password search.
import {root, run} from './common.mjs';
import {writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash, createDecipheriv} from 'node:crypto';
const samples = JSON.parse(run('python3', ['scripts/inspect-model.py', '--samples'], {encoding: 'utf8', stdio: 'pipe'}).stdout);
const fields = [samples.info, samples.weight.suffix, samples.mdcf.suffix];
const keys = fields.flatMap(s => [Buffer.from(s), Buffer.from([...s].reverse().join('')), ...['md5', 'sha256'].map(h => createHash(h).update(s).digest())]);
const ivs = [Buffer.alloc(16), ...fields.map(s => Buffer.from(s))];
let tests = 0;
const hits = [];
for (const label of ['weight', 'mdcf']) {
  const data = Buffer.from(samples[label].all ?? samples[label].head, 'hex');
  for (const key of keys) for (const mode of ['ecb', 'cbc', 'ctr', 'cfb', 'ofb']) for (const iv of mode === 'ecb' ? [null] : ivs) {
    try {
      const decoder = createDecipheriv(`aes-${key.length * 8}-${mode}`, key, iv);
      decoder.setAutoPadding(false);
      const decoded = Buffer.concat([decoder.update(data), decoder.final()]);
      tests++;
      const text = decoded.subarray(0, 96).toString('utf8');
      if (decoded.subarray(0, 2).equals(Buffer.from([0x80, 2])) || decoded.subarray(0, 4).equals(Buffer.from('PK\x03\x04')) || /^[\s]*[\[{][\s"'\d]/.test(text)) {
        hits.push({label, mode, keyBits: key.length * 8, head: decoded.subarray(0, 16).toString('hex')});
      }
    } catch { /* Unsupported candidate is not evidence of a cipher. */ }
  }
}
const result = {testedCandidateCombinations: tests, recognizedPlaintextHeaders: hits, scope: 'Direct 16-character fields, reversal, MD5/SHA256 transforms; AES ECB/CBC/CTR/CFB/OFB. A miss does not identify or rule out a cipher. Header matches would require independent validation.'};
const dir = path.join(root, '.local/analysis');
mkdirSync(dir, {recursive: true});
writeFileSync(path.join(dir, 'wrapper-probe.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
