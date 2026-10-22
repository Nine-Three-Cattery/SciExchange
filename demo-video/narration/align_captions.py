import json
from pathlib import Path
import os
import sys
import re
import hashlib

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tts'))
from runtime import configure_environment
configure_environment()
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
import torch
import stable_whisper

torch.set_num_threads(4)
model=stable_whisper.load_model(str(ROOT/'.local/whisper/tiny.en.pt'),device='cpu')
scenes=json.loads((ROOT/'planning/timeline.json').read_text())
captions=[]
for scene in scenes:
    cache=ROOT/'public/generated/production/audio'/f'{scene["id"]}.alignment.json'
    fingerprint=hashlib.sha256((ROOT/'public'/scene['audio']).read_bytes()).hexdigest()
    result=json.loads(cache.read_text()) if cache.exists() else None
    if result is None or result.get('source_audio_sha256')!=fingerprint or result.get('source_text')!=scene['text']:
        audio,sr=sf.read(ROOT/'public'/scene['audio'],dtype='float32')
        if sr!=16000:audio=resample_poly(audio,16000,sr).astype(np.float32)
        aligned=model.align(audio,scene['text'],language='en',verbose=False,regroup=False)
        if aligned is None:raise RuntimeError('Alignment failed '+scene['id'])
        result=aligned.to_dict()
        result['source_audio_sha256']=fingerprint
        result['source_text']=scene['text']
        cache.write_text(json.dumps(result,indent=2)+'\n')
    words=[{'text':w['word'].strip(),'start':w['start'],'end':w['end']} for segment in result['segments'] for w in segment['words'] if w['word'].strip()]
    expected=re.sub(r'\W','',scene['text']).lower()
    actual=re.sub(r'\W','',''.join(w['text'] for w in words)).lower()
    if actual!=expected:raise RuntimeError('Aligned caption text mismatch '+scene['id'])
    group=[]
    offset=scene['from']/30+scene['narrationOffset']
    def flush():
        if not group:return
        captions.append({'scene':scene['id'],'start':offset+group[0]['start'],'end':offset+max(group[-1]['end'],group[0]['start']+.12),'text':' '.join(w['text'] for w in group),'words':[{'text':w['text'],'start':offset+w['start'],'end':offset+w['end']} for w in group]})
        group.clear()
    for word in words:
        if group and (sum(len(w['text'])+1 for w in group)+len(word['text'])>66 or word['end']-group[0]['start']>4):flush()
        group.append(word)
        if word['text'].endswith(('.', '!', '?', ';')):flush()
    flush()
    print('Aligned',scene['id'],len(words),'words',flush=True)

target=ROOT/'narration/captions.json';target.write_text(json.dumps(captions,indent=2)+'\n')
output=ROOT/'output';output.mkdir(exist_ok=True)
def ts(s):
    n=round(s*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
def wrap(text):
    words=text.split();lines=['']
    for w in words:
        if len(lines[-1])+len(w)+1>40 and len(lines)<2:lines.append('')
        lines[-1]+=(' ' if lines[-1] else '')+w
    return '\n'.join(lines)
(output/'subtitles.srt').write_text('\n\n'.join(f'{i+1}\n{ts(c["start"])} --> {ts(c["end"])}\n{wrap(c["text"])}' for i,c in enumerate(captions))+'\n')
assert all(c['end']<=229 and c['start']>=0 and c['end']>c['start'] for c in captions)
print('Caption cues',len(captions),flush=True)
