import argparse
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import time

from runtime import ROOT, SOURCE, LOCAL, CONFIG, REFERENCE, activate_runtime, configure_environment


def require_runtime_assets():
    lock = json.loads((ROOT / 'tts/assets.lock.json').read_text())
    for item in lock['files']:
        if not item['destination'].startswith('tts/GPT-SoVITS/'):
            continue
        path = ROOT / item['destination']
        if not path.is_file() or path.stat().st_size != item['bytes']:
            raise FileNotFoundError(f'Missing or incomplete runtime asset: {path}; run npm run tts:setup')
    model_dir = SOURCE / 'GPT_SoVITS/text/G2PWModel'
    if not any((model_dir / name).is_file() for name in ['g2pW.onnx', 'g2pw.onnx']):
        raise FileNotFoundError('G2PW missing; run npm run tts:setup')
    if not CONFIG.is_file() or not REFERENCE.is_file():
        raise FileNotFoundError('Reference configuration missing; run npm run tts:prepare')


def make_config():
    import yaml
    models = SOURCE / 'GPT_SoVITS/pretrained_models'
    custom = {
        'device': 'cpu', 'is_half': False, 'version': 'v5turbo',
        't2s_weights_path': str(models / 's1v3.ckpt'),
        'vits_weights_path': str(models / 'gsv-v5-pretrained/s2Gv5turbo.pth'),
        'bert_base_path': str(models / 'chinese-roberta-wwm-ext-large'),
        'cnhuhbert_base_path': str(models / 'chinese-hubert-base'),
    }
    CONFIG.write_text(yaml.safe_dump({'custom': custom}, sort_keys=False))
    return custom


def prepare_reference():
    configure_environment()
    import pyarrow.parquet as pq
    import soundfile as sf
    import numpy as np
    archive = LOCAL / 'tts-downloads/ace-taffy.parquet'
    table = pq.read_table(archive)
    index = 1804  # Page p=18, 100 rows per page; zero-based dataset row.
    row = table.slice(index, 1).to_pylist()[0]
    if row['segment_id'] != '001805':
        raise ValueError('Pinned dataset row identity changed')
    audio = row['audio']
    if not audio.get('bytes'):
        raise ValueError('Expected embedded WAV bytes in pinned Parquet')
    samples, sr = sf.read(io.BytesIO(audio['bytes']), dtype='float32')
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    duration = len(samples) / sr
    if not 3 <= duration <= 10 or not np.isfinite(samples).all() or float(np.max(np.abs(samples))) < 0.001:
        raise ValueError('Reference audio is invalid or silent')
    directory = REFERENCE.parent
    directory.mkdir(parents=True, exist_ok=True)
    original = directory / 'reference-source.wav'
    original.write_bytes(audio['bytes'])
    target = directory / 'reference.wav'
    sf.write(target, samples, sr, subtype='PCM_16')
    manifest = {
        'voice_name': 'Ace Taffy / 永雏塔菲', 'mode': 'zero-shot reference conditioning; no fine-tuning',
        'dataset': 'KYOU-0/Ace-Taffy-voice', 'revision': '48623d4de7338a82a83bd9c76a9a4ee193aadb3f',
        'viewer': 'https://huggingface.co/datasets/KYOU-0/Ace-Taffy-voice/viewer/default/train?p=18',
        'row_index': index, 'segment_id': row['segment_id'], 'source_id': row['source_id'],
        'transcription': row['transcription'], 'prompt_lang': 'all_zh',
        'sample_rate': sr, 'duration_seconds': duration,
        'reference_audio': str(target.relative_to(ROOT)),
        'source_sha256': hashlib.sha256(audio['bytes']).hexdigest(),
        'reference_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'license_declared_by_dataset': 'mit',
    }
    REFERENCE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (directory / 'reference.txt').write_text(row['transcription'] + '\n')
    (directory / 'reference.list').write_text(f'{target}|ace-taffy|zh|{row["transcription"]}\n')
    make_config()
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)


def doctor():
    import importlib.metadata as md
    import torch
    from transformers import AutoTokenizer
    require_runtime_assets()
    assert torch.__version__.split('+')[0] == '2.7.0'
    assert CONFIG.is_file() and REFERENCE.is_file(), 'Run npm run tts:prepare'
    config = make_config()
    for key in ('t2s_weights_path', 'vits_weights_path', 'bert_base_path', 'cnhuhbert_base_path'):
        assert Path(config[key]).exists(), f'Missing {key}'
    assert (SOURCE / 'GPT_SoVITS/pretrained_models/gsv-v5-pretrained/vocoder.pth').is_file()
    assert (SOURCE / 'GPT_SoVITS/text/G2PWModel').is_dir()
    assert (SOURCE / 'GPT_SoVITS/pretrained_models/fast_langdetect/lid.176.bin').is_file()
    AutoTokenizer.from_pretrained(config['bert_base_path'], local_files_only=True)
    reference = json.loads(REFERENCE.read_text())
    assert hashlib.sha256((ROOT / reference['reference_audio']).read_bytes()).hexdigest() == reference['reference_sha256']
    versions = {name: md.version(name) for name in ['torch', 'torchaudio', 'transformers', 'librosa', 'onnxruntime']}
    print(json.dumps({'status': 'assets-and-dependencies-ready', 'python': sys.version.split()[0], 'versions': versions, 'engine': 'GPT-SoVITS-v5turbo', 'device': 'cpu', 'is_half': False, 'voice': reference['voice_name'], 'reference_seconds': reference['duration_seconds'], 'note': 'Use tts:smoke to verify actual synthesis.'}, ensure_ascii=False, indent=2))


def synthesize(text, output, language='all_zh'):
    if not text.strip() or len(text) > 2000:
        raise ValueError('Provide 1–2000 characters for a local synthesis job')
    output = (ROOT / output).resolve()
    output.relative_to(ROOT)  # Generated media must stay in demo-video.
    require_runtime_assets()
    reference = json.loads(REFERENCE.read_text())
    ref = ROOT / reference['reference_audio']
    if hashlib.sha256(ref.read_bytes()).hexdigest() != reference['reference_sha256']:
        raise ValueError('Reference checksum mismatch; run tts:prepare')
    activate_runtime()
    from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config
    import numpy as np
    import soundfile as sf
    start = time.monotonic()
    pipeline = TTS(TTS_Config(str(CONFIG)))
    if pipeline.configs.version != 'v5turbo':
        raise RuntimeError(f'Wrong engine loaded: {pipeline.configs.version}')
    request = {
        'text': text, 'text_lang': language, 'ref_audio_path': str(ref),
        'prompt_text': reference['transcription'], 'prompt_lang': 'all_zh',
        'seed': 42, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0,
        'text_split_method': 'cut5', 'batch_size': 1, 'speed_factor': 1.0,
        'streaming_mode': False, 'parallel_infer': False,
        'use_cuda_graph': False, 'use_flash_attention': False,
        'sample_steps': 4, 'cfg_rate': 0.0, 'super_sampling': False,
    }
    chunks = list(pipeline.run(request))
    if not chunks:
        raise RuntimeError('Engine returned no audio')
    rates = {sr for sr, _ in chunks}
    if rates != {48000}:
        raise RuntimeError(f'Unexpected v5 output sample rate: {rates}')
    audio = np.concatenate([audio for _, audio in chunks])
    if len(audio) < 4800 or not np.isfinite(audio).all() or float(np.max(np.abs(audio.astype(np.float64)))) < 1:
        raise RuntimeError('Engine returned invalid or silent audio')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.stem + '.part.wav')
    sf.write(temporary, audio, 48000, subtype='PCM_16')
    temporary.replace(output)
    result = {
        'synthetic': True, 'engine': 'GPT-SoVITS-v5turbo', 'voice': reference['voice_name'],
        'text': text, 'text_lang': language, 'device': 'cpu', 'sample_rate': 48000, 'duration_seconds': len(audio) / 48000,
        'elapsed_seconds': round(time.monotonic() - start, 2), 'seed': 42,
        'reference': reference, 'file': str(output.relative_to(ROOT)),
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'validation': 'Model version, sample rate, finite samples and non-silent waveform verified; no automatic transcription or perceptual quality score.',
    }
    output.with_suffix('.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'doctor', 'synthesize', 'serve'])
    parser.add_argument('--text')
    parser.add_argument('--text-file')
    parser.add_argument('--output', default='public/generated/narration.wav')
    parser.add_argument('--language', choices=['all_zh', 'en'], default='all_zh')
    parser.add_argument('--port', type=int, default=9880)
    args = parser.parse_args()
    configure_environment()
    if args.command == 'prepare':
        prepare_reference()
    elif args.command == 'doctor':
        doctor()
    elif args.command == 'synthesize':
        if bool(args.text) == bool(args.text_file):
            parser.error('Choose exactly one of --text or --text-file')
        text = (ROOT / args.text_file).read_text() if args.text_file else args.text
        synthesize(text, args.output, args.language)
    else:
        require_runtime_assets()
        activate_runtime()
        sys.argv = ['api_v2.py', '-c', str(CONFIG), '-a', '127.0.0.1', '-p', str(args.port)]
        runpy.run_path(str(SOURCE / 'api_v2.py'), run_name='__main__')


if __name__ == '__main__':
    main()
