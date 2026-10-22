"""Static inspection only. Never import torch or unpickle an unknown model.

The limited interpreter reads literal containers and treats OrderedDict as a
dictionary marker. All other globals, constructors and persistent IDs fail.
"""
import base64
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import pickletools
import sys

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / '.local/models/高松灯/高松灯.msvc'
MARK = object()
ORDERED_DICT = object()


def read_literals(stream):
    stack, memo = [], {}
    for count, (op, arg, _) in enumerate(pickletools.genops(stream)):
        if count > 20000:
            raise ValueError('Opcode budget exceeded')
        name = op.name
        if name == 'PROTO':
            if arg != 2:
                raise ValueError('Only inspected protocol 2 is supported')
        elif name in ('INT', 'LONG', 'LONG1', 'LONG4', 'BININT', 'BININT1', 'BININT2', 'BINFLOAT', 'BINUNICODE', 'SHORT_BINUNICODE', 'UNICODE'):
            stack.append(arg)
        elif name in ('NEWTRUE', 'NEWFALSE', 'NONE'):
            stack.append({'NEWTRUE': True, 'NEWFALSE': False, 'NONE': None}[name])
        elif name == 'GLOBAL' and arg == 'collections OrderedDict':
            stack.append(ORDERED_DICT)
        elif name == 'REDUCE':
            args, marker = stack.pop(), stack.pop()
            if marker is not ORDERED_DICT or args != ():
                raise ValueError('Callable reduction rejected')
            stack.append({})
        elif name in ('EMPTY_DICT', 'EMPTY_LIST', 'EMPTY_TUPLE'):
            stack.append({'EMPTY_DICT': dict, 'EMPTY_LIST': list, 'EMPTY_TUPLE': tuple}[name]())
        elif name == 'MARK':
            stack.append(MARK)
        elif name in ('BINPUT', 'LONG_BINPUT', 'PUT'):
            memo[arg] = stack[-1]
        elif name in ('BINGET', 'LONG_BINGET', 'GET'):
            stack.append(memo[arg])
        elif name in ('APPENDS', 'SETITEMS'):
            i = next(i for i in range(len(stack) - 1, -1, -1) if stack[i] is MARK)
            items = stack[i + 1:]
            del stack[i:]
            if name == 'APPENDS':
                if type(stack[-1]) is not list:
                    raise ValueError('Non-list append')
                stack[-1].extend(items)
            else:
                if type(stack[-1]) is not dict or len(items) % 2:
                    raise ValueError('Invalid dictionary')
                stack[-1].update(zip(items[::2], items[1::2]))
        elif name == 'SETITEM':
            value, key = stack.pop(), stack.pop()
            if type(stack[-1]) is not dict:
                raise ValueError('Non-dictionary assignment')
            stack[-1][key] = value
        elif name == 'STOP':
            if len(stack) != 1:
                raise ValueError('Unexpected stack shape')
            return stack[0]
        else:
            raise ValueError(f'Unsupported opcode: {name}')
    raise ValueError('Missing STOP')


def describe_payload(value):
    result = {'type': type(value).__name__, 'characters': len(value)}
    # Record structure, not the large payload or candidate key material.
    padding_end = value.rfind('=') + 1
    result['characters_after_base64_padding'] = len(value) - padding_end if padding_end else None
    result['base64_candidates'] = []
    if padding_end:
        for offset in range(17):
            body = value[offset:padding_end]
            if len(body) % 4:
                continue
            try:
                decoded = base64.b64decode(body, validate=True)
            except ValueError:
                continue
            sample = decoded[:1048576]
            entropy = -sum((c / len(sample)) * math.log2(c / len(sample)) for c in Counter(sample).values()) if sample else 0
            result['base64_candidates'].append({
                'prefix_characters': offset, 'decoded_bytes': len(decoded),
                'multiple_of_aes_block': len(decoded) % 16 == 0,
                'sample_entropy_bits_per_byte': round(entropy, 5),
                'recognized_magic': next((label for magic, label in [(b'PK\x03\x04', 'zip/torch'), (b'\x80\x02', 'pickle'), (b'\x1f\x8b', 'gzip'), (b'{', 'json')] if decoded.startswith(magic)), None),
            })
    return result


def main():
    samples_only = sys.argv[1:] == ['--samples']
    model = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 and not samples_only else MODEL
    if model.stat().st_size > 128 * 1024 * 1024:
        raise ValueError('Inspection limited to 128 MiB')
    with model.open('rb') as stream:
        magic, protocol, system, payload, storages = [read_literals(stream) for _ in range(5)]
        trailing = len(stream.read())
    if not isinstance(payload, dict):
        raise ValueError('Expected checkpoint dictionary')
    if samples_only:
        samples = {'info': payload['info']}
        for key in ('weight', 'mdcf'):
            value = payload[key]
            decoded = base64.b64decode(value[2:-16], validate=True)
            samples[key] = {'suffix': value[-16:], 'head': decoded[:64].hex()}
            if key == 'mdcf':
                samples[key]['all'] = decoded.hex()
        print(json.dumps(samples))
        return
    with model.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    report = {
        'file': model.name, 'bytes': model.stat().st_size,
        'sha256': digest,
        'container': 'torch legacy serialization' if magic == 0x1950A86A20F9469CFC6C else 'unknown',
        'serialization_protocol': protocol, 'system': system,
        'keys': list(payload), 'architecture_config': payload.get('config'),
        'sample_rate': payload.get('sr'), 'f0': payload.get('f0'), 'version': payload.get('version'),
        'weight': describe_payload(payload['weight']),
        'mdcf': describe_payload(payload['mdcf']),
        'tensor_storage_count': len(storages), 'trailing_bytes': trailing,
        'inference': 'RVC v2-style 40 kHz pitch-conditioned voice-conversion checkpoint with wrapped weights; not a directly usable TTS checkpoint',
        'limitations': 'Cipher, key derivation, loader and originating application are not confirmed by static metadata.',
        'inspection_method': 'Restricted literal opcode interpreter; no pickle.load, torch.load or model execution',
    }
    target = ROOT / '.local/analysis'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'model-inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
