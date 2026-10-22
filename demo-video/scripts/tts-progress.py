"""Report actual fetched bytes once per asset, including resumable ranges."""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
import sys

ROOT = Path(__file__).resolve().parents[1]
lock = json.loads((ROOT / 'tts/assets.lock.json').read_text())
assets = []
for item in lock['files']:
    target = ROOT / item['destination']
    expected = item['bytes']
    directory = ROOT / '.local/tts-ranges' / hashlib.sha256(item['url'].encode()).hexdigest()[:20]
    complete = target.is_file() and target.stat().st_size == expected
    if complete:
        fetched = expected
    elif directory.is_dir():
        fetched = sum(part.stat().st_size for part in directory.iterdir() if part.is_file() and (part.name == 'prefix' or part.name.replace('-', '').isdigit()))
    else:
        candidates = [p.stat().st_size for p in [target, target.with_name(target.name + '.part')] if p.is_file()]
        fetched = max(candidates, default=0)
    assets.append({'file': item['destination'], 'fetched': min(fetched, expected), 'expected': expected, 'complete_length': complete})
done, total = sum(x['fetched'] for x in assets), sum(x['expected'] for x in assets)
report = {'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'fetched_bytes': done, 'expected_bytes': total, 'percent': round(100 * done / total, 1), 'complete_length_count': sum(x['complete_length'] for x in assets), 'total_assets': len(assets), 'assets': assets, 'note': 'Fetched bytes are not a checksum or synthesis success. Setup verifies SHA-256 before accepting each large asset.'}
state = ROOT / '.local/tts-setup-state.json'
if state.exists():
    report['setup_state'] = json.loads(state.read_text())
log = ROOT / '.local/tts-setup.log'
if log.exists():
    report['recent_log'] = log.read_text(errors='replace').splitlines()[-5:]
if '--json' in sys.argv:
    print(json.dumps(report, ensure_ascii=False, indent=2))
else:
    print(f'已下载 {done / 1e9:.3f} / {total / 1e9:.3f} GB（{report["percent"]}%）；完整长度文件 {report["complete_length_count"]}/{len(assets)}')
    for item in assets:
        if not item['complete_length']:
            print(f'  {Path(item["file"]).name}: {item["fetched"]/1e6:.1f}/{item["expected"]/1e6:.1f} MB')
    print(report['note'])
    if report.get('setup_state', {}).get('status') == 'failed':
        print('Setup failed:', report['setup_state']['error'])
