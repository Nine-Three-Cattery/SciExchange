"""Mix the supplied MP3 beneath original-rate narration, with fades and ducking."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
directory=ROOT/'public/generated/production'
local=ROOT/'.local/music/supplied-bgm.mp3'
source=Path(os.environ.get('BGM_SOURCE', str(local))).expanduser()
local.parent.mkdir(parents=True,exist_ok=True)
if not source.is_file():
    raise FileNotFoundError('Music is missing. Set BGM_SOURCE to an MP3 or place it at .local/music/supplied-bgm.mp3')
if source.resolve()!=local.resolve():shutil.copyfile(source,local)
source_hash=hashlib.sha256(local.read_bytes()).hexdigest()
ffmpeg=ROOT/'node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg'
def ff(args):
    subprocess.run([str(ffmpeg),'-y','-hide_banner','-loglevel','error',*args],check=True)

scenes=json.loads((ROOT/'planning/timeline.json').read_text())
sr=48000;duration=229;count=sr*duration
voice=np.zeros(count,dtype=np.float32)
gains=[]
for scene in scenes:
    audio,rate=sf.read(ROOT/'public'/scene['audio'],dtype='float32')
    assert rate==sr
    nonzero=audio[np.abs(audio)>.002]
    rms=float(np.sqrt(np.mean(nonzero**2)))
    gain=min(10**(-19/20)/max(rms,1e-5),.86/max(float(np.max(np.abs(audio))),1e-5))
    start=round((scene['from']/30+scene['narrationOffset'])*sr)
    assert start+len(audio)<=count
    voice[start:start+len(audio)]+=audio*gain
    gains.append({'id':scene['id'],'gain':gain,'original_samples':len(audio),
                  'timeline_offset_samples':start,'tempo_factor':1.0})
sf.write(directory/'narration.wav',voice,sr,subtype='PCM_16')
voice_hash=hashlib.sha256((directory/'narration.wav').read_bytes()).hexdigest()
previous=ROOT/'.local/revisions/pre-mp3-4k/narration.wav'
if previous.exists():assert voice_hash==hashlib.sha256(previous.read_bytes()).hexdigest(),'Narration changed'

# Decode audio only; exclude embedded artwork and original ID3 metadata.
ff(['-i',str(local),'-map','0:a:0','-vn','-map_metadata','-1','-ar',str(sr),'-ac','2',
    '-c:a','pcm_s16le',str(directory/'music/supplied-source.wav')])
track,rate=sf.read(directory/'music/supplied-source.wav',dtype='float32')
assert rate==sr and track.ndim==2 and track.shape[1]==2
length=len(track);overlap=4*sr
assert length>overlap*2
music=np.zeros((count,2),dtype=np.float32)
music[:min(count,length)]=track[:min(count,length)]
cursor=length;joins=[]
while cursor<count:
    start=cursor-overlap
    blend=min(overlap,count-start)
    angle=np.linspace(0,np.pi/2,blend,dtype=np.float32)[:,None]
    music[start:start+blend]=music[start:start+blend]*np.cos(angle)+track[:blend]*np.sin(angle)
    n=min(length-blend,count-start-blend)
    music[start+blend:start+blend+n]=track[blend:blend+n]
    joins.append({'start_seconds':start/sr,'crossfade_seconds':blend/sr})
    cursor=start+length

baseline_db=-33;boost_db=2
music*=10**(baseline_db/20)/max(float(np.sqrt(np.mean(music**2))),1e-8)
t=np.arange(count)/sr
fade_in=4;fade_out=8
music*=(np.minimum(1,t/fade_in)*np.clip((duration-t)/fade_out,0,1))[:,None].astype(np.float32)
sf.write(directory/'supplied-music-bed.wav',music,sr,subtype='PCM_16')

# Make room for speech consonants in the music, retain stereo, and duck smoothly.
duck=f'[0:a]volume={boost_db}dB:precision=double,equalizer=f=2500:t=q:w=1:g=-3,aformat=sample_fmts=dbl:channel_layouts=stereo[raised];[1:a]aformat=sample_fmts=dbl:channel_layouts=stereo[key];[raised][key]sidechaincompress=threshold=0.015:ratio=6:attack=15:release=500,aformat=sample_fmts=s16:channel_layouts=stereo[bed]'
ff(['-i',str(directory/'supplied-music-bed.wav'),'-i',str(directory/'narration.wav'),
    '-filter_complex',duck,'-map','[bed]','-t',str(duration),'-ar',str(sr),'-ac','2',
    '-c:a','pcm_s16le',str(directory/'music-ducked.wav')])
bed,_=sf.read(directory/'music-ducked.wav',dtype='float32')
window=int(sr*.4);windows=count//window
voice_rms=np.sqrt(np.mean(voice[:windows*window].reshape(-1,window)**2,axis=1))
music_rms=np.sqrt(np.mean(bed[:windows*window].reshape(-1,window,2)**2,axis=(1,2)))
speaking=voice_rms>10**(-32/20)
caps=np.ones_like(voice_rms)
caps[speaking]=np.minimum(1,voice_rms[speaking]/np.maximum(music_rms[speaking],1e-8)*10**(-18/20))
safe=np.minimum.reduce([caps,np.r_[caps[0],caps[:-1]],np.r_[caps[1:],caps[-1]]])
envelope=np.interp(np.arange(count),(np.arange(len(safe))+.5)*window,safe)
bed*=envelope[:,None].astype(np.float32)
sf.write(directory/'music-ducked.wav',bed,sr,subtype='PCM_16')
music_rms=np.sqrt(np.mean(bed[:windows*window].reshape(-1,window,2)**2,axis=(1,2)))
margins=20*np.log10(np.maximum(voice_rms[speaking],1e-8)/np.maximum(music_rms[speaking],1e-8))
assert np.min(margins)>=17.9,'Music too loud beneath narration'
filters='[0:a]aformat=channel_layouts=stereo[v];[1:a]aformat=channel_layouts=stereo[m];[v][m]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,aformat=channel_layouts=stereo,alimiter=limit=0.95:level=false[out]'
ff(['-i',str(directory/'narration.wav'),'-i',str(directory/'music-ducked.wav'),'-filter_complex',filters,
    '-map','[out]','-t',str(duration),'-ar',str(sr),'-ac','2','-c:a','pcm_s16le',str(directory/'mix.wav')])
mix,rate=sf.read(directory/'mix.wav');assert len(mix)==count and rate==sr
manifest={'source_file':str(source),'local_copy':str(local.relative_to(ROOT)),
          'sha256':source_hash,'title':'桃の節句と艦娘','artist':'大越香里',
          'decoded_duration_seconds':length/sr,'loop_joins':joins,
          'fade_in_seconds':fade_in,'fade_out_seconds':fade_out,
          'source_kind':'User-supplied MP3; used as requested. No independent licensing verification claimed.',
          'source_metadata_and_artwork_removed':True}
(directory/'music/supplied-bgm.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
processing={'duration_seconds':duration,'sample_rate':sr,'speed_changes':False,
 'voice_processing':'Unchanged per-segment constant gain, full-mix loudness normalization and limiting only',
 'narration_stem_sha256':voice_hash,'narration_stem_unchanged':True,'gains':gains,
 'mix_peak':float(np.max(np.abs(mix))),'music_gain_db':boost_db,'music_baseline_rms_dbfs':baseline_db,
 'speech_to_music_analysis':{'window_seconds':.4,'speech_rms_threshold_dbfs':-32,
   'minimum_margin_db':float(np.min(margins)),'median_margin_db':float(np.median(margins)),
   'additional_music_protection':'Smooth 18 dB margin cap below quiet speech; music-only speech-band EQ; narration unchanged',
   'protected_window_fraction':float(np.mean(safe<1))},
 'music_source':'User-supplied MP3: Kaori Ohkoshi, Momo no Sekku to Kanmusu. Exact source hash and original title in music/supplied-bgm.json.',
 'music_fades':{'in_seconds':fade_in,'out_seconds':fade_out,'loop_joins':joins}}
(ROOT/'narration/audio-processing.json').write_text(json.dumps(processing,indent=2)+'\n')
print(json.dumps({'mixed_seconds':duration,'minimum_voice_margin_db':float(np.min(margins)),
 'median_voice_margin_db':float(np.median(margins)),'music_fades':processing['music_fades'],'narration_unchanged':True},indent=2))
