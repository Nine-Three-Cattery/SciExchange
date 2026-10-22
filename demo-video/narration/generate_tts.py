"""Generate production narration at original GPT-SoVITS speed, one segment each."""
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tts'))
from runtime import activate_runtime, REFERENCE, CONFIG
from runner import require_runtime_assets

require_runtime_assets()
activate_runtime()
import numpy as np
import soundfile as sf
from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config

script = json.loads((ROOT / 'narration/script.json').read_text())
reference = json.loads(REFERENCE.read_text())
pipeline = TTS(TTS_Config(str(CONFIG)))
assert pipeline.configs.version == 'v5turbo'
directory = ROOT / 'public/generated/production/audio'
directory.mkdir(parents=True, exist_ok=True)
records = []
for scene in script:
    target = directory / (scene['id'] + '.wav')
    metadata = target.with_suffix('.json')
    if target.is_file() and metadata.is_file():
        cached = json.loads(metadata.read_text())
        if cached.get('text') == scene['text'] and cached.get('speed_factor') == 1.0:
            records.append(cached)
            print('Cached narration', scene['id'], cached['duration'], flush=True)
            continue
    start = time.monotonic()
    request = {
        'text': scene['text'], 'text_lang': 'en',
        'ref_audio_path': str(ROOT / reference['reference_audio']),
        'prompt_text': reference['transcription'], 'prompt_lang': 'all_zh',
        'seed': 42, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0,
        'text_split_method': 'cut5', 'batch_size': 1, 'speed_factor': 1.0,
        'streaming_mode': False, 'parallel_infer': False,
        'use_cuda_graph': False, 'use_flash_attention': False,
        'sample_steps': 4, 'cfg_rate': 0.0, 'super_sampling': False,
    }
    chunks = list(pipeline.run(request))
    if not chunks or {r for r, _ in chunks} != {48000}:
        raise RuntimeError('Invalid narration output')
    audio = np.concatenate([a for _, a in chunks])
    if not np.isfinite(audio).all() or np.max(np.abs(audio.astype(float))) < 1:
        raise RuntimeError('Invalid or silent narration')
    sf.write(target, audio, 48000, subtype='PCM_16')
    record = {'id': scene['id'], 'text': scene['text'], 'duration': len(audio) / 48000,
        'frames': len(audio), 'sample_rate': 48000, 'speed_factor': 1.0,
        'engine': 'GPT-SoVITS-v5turbo', 'voice': reference['voice_name'],
        'reference_sha256': reference['reference_sha256'],
        'file': str(target.relative_to(ROOT / 'public')),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'generation_seconds': round(time.monotonic() - start, 2)}
    metadata.write_text(json.dumps(record, indent=2) + '\n')
    records.append(record)
    print('NARRATION READY', scene['id'], record['duration'], flush=True)
(ROOT / 'narration/measured.json').write_text(json.dumps(records, indent=2) + '\n')
(ROOT / 'narration/script.md').write_text('# English narration\n\n' + '\n\n'.join(f'## {s["id"]} — {s["title"]}\n\n{s["text"]}' for s in script) + '\n')
print('TOTAL UNMODIFIED SPEECH', sum(r['duration'] for r in records), flush=True)
