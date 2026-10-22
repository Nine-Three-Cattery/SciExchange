"""Local paths and macOS adaptation; leave the upstream source unchanged."""
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tts/GPT-SoVITS'
LOCAL = ROOT / '.local'
CONFIG = LOCAL / 'tts-infer.yaml'
REFERENCE = LOCAL / 'voices/ace-taffy/reference.json'


def configure_environment():
    for name, value in {
        'HF_HOME': LOCAL / 'huggingface', 'TORCH_HOME': LOCAL / 'torch',
        'XDG_CACHE_HOME': LOCAL / 'cache', 'MPLCONFIGDIR': LOCAL / 'matplotlib',
        'NUMBA_CACHE_DIR': LOCAL / 'numba', 'TMPDIR': LOCAL / 'tmp',
    }.items():
        Path(value).mkdir(parents=True, exist_ok=True)
        os.environ[name] = str(value)
    os.environ.setdefault('OMP_NUM_THREADS', '4')
    os.environ.setdefault('MKL_NUM_THREADS', '4')
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['PYTHONUNBUFFERED'] = '1'


def activate_runtime():
    configure_environment()
    if not SOURCE.is_dir():
        raise FileNotFoundError('GPT-SoVITS source missing; run npm run tts:setup')
    os.chdir(SOURCE)
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'GPT_SoVITS')]
    from tools import portable_runtime
    # This pinned upstream revision names Windows executables even on macOS.
    # Override those module constants before TTS or api_v2 imports copy them.
    portable_runtime.FFMPEG_EXE = ROOT / 'node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg'
    portable_runtime.FFPROBE_EXE = ROOT / 'node_modules/@ffprobe-installer/darwin-arm64/ffprobe'
    if not portable_runtime.FFMPEG_EXE.is_file():
        raise FileNotFoundError('Project FFmpeg missing; run npm ci')
    os.environ['PATH'] = str(portable_runtime.FFMPEG_EXE.parent) + os.pathsep + os.environ.get('PATH', '')
    portable_runtime.activate(change_cwd=True)
    import torch
    torch.set_num_threads(4)
    return portable_runtime
