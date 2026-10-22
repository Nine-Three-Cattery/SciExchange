"""Rebuild the isolated macOS arm64 inference environment from pinned assets."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import venv
import zipfile
import fcntl
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'tts/assets.lock.json').read_text())
LOCAL = ROOT / '.local'
ENV = dict(os.environ, UV_CACHE_DIR=str(LOCAL / 'uv-cache'), UV_PYTHON_INSTALL_DIR=str(LOCAL / 'python'), UV_PYTHON_BIN_DIR=str(LOCAL / 'bin'), PIP_CACHE_DIR=str(LOCAL / 'pip-cache'))


def run(args, **kwargs):
    subprocess.run([str(arg) for arg in args], cwd=ROOT, env=ENV, check=True, **kwargs)


def sha256(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checksum_valid(file, item):
    if item.get('sha256') and sha256(file) != item['sha256']:
        return False
    if item.get('md5'):
        with file.open('rb') as stream:
            if hashlib.file_digest(stream, 'md5').hexdigest() != item['md5']:
                return False
    return True


def download(item):
    target = ROOT / item['destination']
    target.resolve().relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and (not item.get('bytes') or target.stat().st_size == item['bytes']):
        if checksum_valid(target, item):
            print('Cached:', item['destination'], flush=True)
            return target
    if item.get('bytes', 0) > 1024 * 1024:
        return ranged_download(item, target)
    tmp = target.with_name(target.name + '.setup-part')
    for attempt in range(3):
        try:
            request = urllib.request.Request(item['url'], headers={'User-Agent': 'SciExchange-demo-video-setup'})
            with urllib.request.urlopen(request, timeout=90) as response, tmp.open('wb') as out:
                while chunk := response.read(1024 * 1024):
                    out.write(chunk)
            if item.get('bytes') and tmp.stat().st_size != item['bytes']:
                raise ValueError('Size mismatch: ' + item['destination'])
            if not checksum_valid(tmp, item):
                raise ValueError('SHA256 mismatch: ' + item['destination'])
            tmp.replace(target)
            print('Downloaded:', item['destination'], flush=True)
            return target
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def ranged_download(item, target):
    """Bounded HTTP ranges avoid silent truncation of long CDN transfers."""
    size = item['bytes']
    name = hashlib.sha256(item['url'].encode()).hexdigest()[:20]
    directory = LOCAL / 'tts-ranges' / name
    directory.mkdir(parents=True, exist_ok=True)
    prefix = directory / 'prefix'
    if not prefix.exists():
        candidates = [p for p in [target, target.with_name(target.name + '.part')] if p.is_file() and p.stat().st_size < size]
        if candidates:
            shutil.copyfile(max(candidates, key=lambda p: p.stat().st_size), prefix)
        else:
            prefix.touch()
    start = prefix.stat().st_size
    if start > size:
        raise ValueError('Invalid cached download prefix')
    block = 4 * 1024 * 1024
    ranges = [(i, min(i + block, size) - 1) for i in range(start, size, block)]

    def fetch(bounds):
        first, last = bounds
        chunk = directory / f'{first}-{last}'
        expected = last - first + 1
        if chunk.exists() and chunk.stat().st_size == expected:
            return chunk
        for attempt in range(5):
            try:
                temporary = chunk.with_suffix('.range-download')
                headers = chunk.with_suffix('.headers')
                result = subprocess.run(['curl', '--fail', '--location', '--connect-timeout', '10', '--max-time', '45', '--range', f'{first}-{last}', '--silent', '--show-error', '--dump-header', str(headers), '--output', str(temporary), '--write-out', '%{http_code}', item['url']], capture_output=True, text=True)
                if result.returncode != 0:
                    raise RuntimeError(f'curl range failed: {result.stderr.strip()}')
                expected_header = f'content-range: bytes {first}-{last}/{size}'
                if result.stdout.strip() != '206' or expected_header not in headers.read_text().lower():
                    raise ValueError('Server did not honor exact Range')
                if temporary.stat().st_size != expected:
                    raise ValueError('Truncated range')
                temporary.replace(chunk)
                return chunk
            except Exception as error:
                if attempt == 4:
                    raise
                print(f'Retrying {target.name} range {first}-{last}: {error}', flush=True)
                time.sleep(1 + attempt)

    print(f'Fetching {item["destination"]}: {start}/{size} bytes already available', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        parts = list(pool.map(fetch, ranges))
    tmp = target.with_name(target.name + '.setup-part')
    with tmp.open('wb') as stream:
        for source in [prefix, *parts]:
            with source.open('rb') as part:
                shutil.copyfileobj(part, stream)
    if tmp.stat().st_size != size or not checksum_valid(tmp, item):
        raise ValueError('Final ranged download checksum mismatch: ' + item['destination'])
    tmp.replace(target)
    print('Verified:', item['destination'], flush=True)
    return target


def extract(zip_path, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            (destination / member.filename).resolve().relative_to(destination.resolve())
            if (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Archive symlink rejected')
        archive.extractall(destination)


def source_checkout():
    target = ROOT / 'tts/GPT-SoVITS'
    revision = LOCK['source']['commit']
    if target.exists():
        marker = target / '.sciexchange-source-revision'
        if (target / '.git').is_dir():
            actual = subprocess.check_output(['git', '-C', str(target), 'rev-parse', 'HEAD'], text=True).strip()
        elif marker.is_file():
            actual = marker.read_text().strip()
        else:
            raise ValueError('Existing source is unrecognized; preserving it')
        if actual != revision:
            raise ValueError('Existing upstream revision differs; preserving it')
        return
    archive = download({'destination': '.local/tts-downloads/source.zip', 'url': f'https://codeload.github.com/RVC-Boss/GPT-SoVITS/zip/{revision}'})
    staging = LOCAL / f'source-{revision}'
    extract(archive, staging)
    unpacked = staging / f'GPT-SoVITS-{revision}'
    unpacked.rename(target)
    (target / '.sciexchange-source-revision').write_text(revision + '\n')


def extract_g2pw():
    target = ROOT / 'tts/GPT-SoVITS/GPT_SoVITS/text/G2PWModel'
    if (target / 'g2pW.onnx').is_file() or (target / 'g2pw.onnx').is_file():
        return
    staging = LOCAL / 'g2pw-unpacked'
    extract(LOCAL / 'tts-downloads/g2pw.zip', staging)
    candidates = sorted({p.resolve() for p in staging.rglob('*.onnx') if p.name.lower() == 'g2pw.onnx'})
    if len(candidates) != 1:
        raise ValueError('G2PW archive model is ambiguous')
    if target.exists():
        raise ValueError('Incomplete G2PW directory exists; preserving it')
    shutil.copytree(candidates[0].parent, target)
    print('G2PW extracted:', target, flush=True)


def main():
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise SystemExit('This environment is pinned and verified for macOS arm64.')
    LOCAL.mkdir(exist_ok=True)
    bootstrap = LOCAL / 'bootstrap'
    if not (bootstrap / 'bin/python').exists():
        venv.create(bootstrap, with_pip=True)
    uv = bootstrap / 'bin/uv'
    if not uv.exists():
        run([bootstrap / 'bin/python', '-m', 'pip', 'install', 'uv==0.13.5'])
    run([uv, 'python', 'install', '3.11.17'])
    python = LOCAL / 'tts-venv/bin/python'
    if not python.exists():
        run([uv, 'venv', '--python', '3.11.17', LOCAL / 'tts-venv'])
    run([uv, 'pip', 'install', '--python', python, '-r', ROOT / 'tts/requirements.lock.txt'])
    source_checkout()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(download, LOCK['files']))
    extract_g2pw()
    for item in LOCK['files']:
        if item.get('extract_to'):
            extract(ROOT / item['destination'], ROOT / item['extract_to'])
    run([python, ROOT / 'tts/runner.py', 'prepare'])
    run([python, ROOT / 'tts/runner.py', 'doctor'])
    print('Setup complete. Run npm run tts:smoke to verify actual speech synthesis.')


if __name__ == '__main__':
    LOCAL.mkdir(exist_ok=True)
    with (LOCAL / 'tts-setup.lock').open('a+') as guard:
        try:
            fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Another TTS setup is running; use npm run tts:progress.')
        state = LOCAL / 'tts-setup-state.json'
        def save_state(status, error=None):
            state.write_text(json.dumps({'status': status, 'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(), 'error': error}, indent=2) + '\n')
        save_state('running')
        try:
            main()
        except BaseException as error:
            save_state('failed', str(error))
            raise
        else:
            save_state('complete')
