"""User-supplied score rendition and volume-only narration processing. No tempo edits."""
import json
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
scenes=json.loads((ROOT/'planning/timeline.json').read_text())
sr=48000;duration=229;count=sr*duration
directory=ROOT/'public/generated/production';directory.mkdir(parents=True,exist_ok=True)
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
    gains.append({'id':scene['id'],'gain':gain,'original_samples':len(audio),'timeline_offset_samples':start,'tempo_factor':1.0})
sf.write(directory/'narration.wav',voice,sr,subtype='PCM_16')

# New piano performance of the score supplied by the user, rendered offline.
t=np.arange(count,dtype=np.float64)/sr
music,rate=sf.read(directory/'music/score-piano.wav',dtype='float32')
assert rate==sr and len(music)==count
if music.ndim==2:music=music.mean(axis=1)
music_rms=float(np.sqrt(np.mean(music**2)))
assert music_rms>1e-5,'Piano render is silent'
music*=10**(-33/20)/music_rms
fade=np.minimum(1,t/4)*np.clip((duration-t)/6,0,1)
music*=fade.astype(np.float32)
sf.write(directory/'score-bed.wav',music,sr,subtype='PCM_16')
ffmpeg=ROOT/'node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg'
music_gain_db=2.0
duck='[0:a]aformat=sample_fmts=dbl:channel_layouts=mono,volume=2dB:precision=double[raised];[1:a]aformat=sample_fmts=dbl:channel_layouts=mono[key];[raised][key]sidechaincompress=threshold=0.018:ratio=4:attack=30:release=450,aformat=sample_fmts=s16:channel_layouts=mono[bed]'
subprocess.run([str(ffmpeg),'-y','-hide_banner','-loglevel','error','-i',str(directory/'score-bed.wav'),'-i',str(directory/'narration.wav'),'-filter_complex',duck,'-map','[bed]','-t','229','-ar','48000','-ac','1','-c:a','pcm_s16le',str(directory/'music-ducked.wav')],check=True)
bed,_=sf.read(directory/'music-ducked.wav',dtype='float32')
window=int(sr*.4)
voice_rms=np.sqrt(np.mean(voice[:count//window*window].reshape(-1,window)**2,axis=1))
music_rms=np.sqrt(np.mean(bed[:count//window*window].reshape(-1,window)**2,axis=1))
speaking=voice_rms>10**(-30/20)
caps=np.ones_like(voice_rms)
caps[speaking]=np.minimum(1,voice_rms[speaking]/np.maximum(music_rms[speaking],1e-8)*10**(-15/20))
# Attenuate adjacent windows too, then interpolate a smooth gain envelope.
# Both endpoints around a speech window remain at or below its own cap.
safe=np.minimum.reduce([caps,np.r_[caps[0],caps[:-1]],np.r_[caps[1:],caps[-1]]])
centers=(np.arange(len(safe))+.5)*window
envelope=np.interp(np.arange(count),centers,safe)
bed*=envelope.astype(np.float32)
sf.write(directory/'music-ducked.wav',bed,sr,subtype='PCM_16')
music_rms=np.sqrt(np.mean(bed[:count//window*window].reshape(-1,window)**2,axis=1))
margins=20*np.log10(np.maximum(voice_rms[speaking],1e-8)/np.maximum(music_rms[speaking],1e-8))
assert np.min(margins)>=14, f'Music too loud beneath speech: {np.min(margins)} dB'
filters='[0:a]aformat=channel_layouts=stereo[v];[1:a]aformat=channel_layouts=stereo[m];[v][m]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,aformat=channel_layouts=stereo,alimiter=limit=0.95:level=false[out]'
subprocess.run([str(ffmpeg),'-y','-hide_banner','-loglevel','error','-i',str(directory/'narration.wav'),'-i',str(directory/'music-ducked.wav'),'-filter_complex',filters,'-map','[out]','-t','229','-ar','48000','-ac','2','-c:a','pcm_s16le',str(directory/'mix.wav')],check=True)
mix,rate=sf.read(directory/'mix.wav');assert len(mix)==count and rate==sr
(ROOT/'narration/audio-processing.json').write_text(json.dumps({'duration_seconds':duration,'sample_rate':sr,'speed_changes':False,'voice_processing':'Per-segment constant gain, full-mix loudness normalization and limiting only','gains':gains,'mix_peak':float(np.max(np.abs(mix))),'music_gain_db':music_gain_db,'music_baseline_rms_dbfs':-33,'speech_to_music_analysis':{'window_seconds':.4,'speech_rms_threshold_dbfs':-30,'minimum_margin_db':float(np.min(margins)),'median_margin_db':float(np.median(margins)),'additional_music_protection':'Smooth gain cap on music below quiet speech; voice unchanged','protected_window_fraction':float(np.mean(safe<1))},'music_source':'New synthesized piano rendition of user-provided sheet-music excerpts from Merry Christmas, Mr. Lawrence, composed by Ryuichi Sakamoto. Source/arrangement in music/score-performance.json; no commercial master recording used.'},indent=2)+'\n')
print('Mixed',duration,'seconds; no speech speed changes; peak',np.max(np.abs(mix)))
