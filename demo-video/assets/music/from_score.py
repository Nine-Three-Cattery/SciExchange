"""Piano excerpt arrangement transcribed from the user's supplied score image.

Uses measures 1–16 and 18–33; repeats these passages for the video, with an
arranged final chord. Not the commercial master recording or a new composition.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/generated/production/music'
OUT.mkdir(parents=True,exist_ok=True)
ATTACHMENT=Path(os.environ.get('SCORE_SOURCE', str(ROOT/'.local/music/source-score.png'))).expanduser()
SOURCE=OUT/'source-score.png'
if not SOURCE.exists():
    if not ATTACHMENT.is_file():
        raise FileNotFoundError('Score image is missing. Set SCORE_SOURCE or place it at .local/music/source-score.png')
    SOURCE.write_bytes(ATTACHMENT.read_bytes())
NAMES={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def midi(name):
    accidental=-1 if 'b' in name else 1 if '#' in name else 0
    return (int(name[-1])+1)*12+NAMES[name[0]]+accidental

events=[]
notes=[]
quarter=60/90
def note(pitch,start,beats,velocity,hand,measure):
    pitches=pitch.split() if isinstance(pitch,str) else pitch
    for i,p in enumerate(pitches):
        seconds=start+i*.018 if len(pitches)>1 and hand=='left' else start
        end=seconds+beats*quarter*.94
        n=midi(p)
        events.extend([{'time':round(seconds,6),'type':'on','note':n,'velocity':velocity},
                       {'time':round(end,6),'type':'off','note':n,'velocity':0}])
        notes.append({'pitch':p,'midi':n,'start':round(seconds,6),'end':round(end,6),
                      'velocity':velocity,'hand':hand,'source_measure':measure})

patterns={
 'a':'F6 Eb6 F6 Bb6 F6 Eb6',
 'b':'F6 Eb6 F6 Ab6 F6 Eb6',
 'c':'Eb6 Db6 Eb6 Ab6 Eb6 Db6',
 'd':'C6 Bb5 C6 F6 C6 Bb5',
 'e':'Gb6 F6 Gb6 Bb6 Gb6 F6',
 'f':'F6 Eb6 F6 Db7 F6 Eb6',
 'g':'Bb6 F6 Eb6 Db7 F6 Eb6',
}
opening=['a','a','b','b','c','c','c','d','a','a','e','e','f','g','f','g']
opening_bass={
 1:('Gb4 Ab4 Db5',6),3:('Gb4 Ab4 C5',6),5:('F4 Ab4 C5',6),
 7:('Db4 F4 Ab4 C5',3),8:('Ab3 C4 F4',3),9:('Gb4 Ab4 Db5',6),
 11:('Eb4 F4 Ab4 C5',6),13:('Eb4 Gb4 Bb4',6),15:('Db4 F4 Ab4 C5',6),
}

# Each tuple is pitches and quarter-note duration; None represents a rest.
main={
 18:[('Eb4',.5),('F4',.5),('Eb4',.5),('Bb3',.5),('Eb4',2)],
 19:[(None,1),('Eb4',.5),('F4',.5),('Eb4',.5),('F4',.5),('Ab4',.5),('F4',.5)],
 20:[('Eb4',.5),('F4',.5),('Eb4',.5),('Bb3',.5),('Db4',2)],
 21:[(None,1),('Bb4 Db5',1),('F4 C5',.5),('Db4 Ab4',.5),('Db4 F4',1)],
 22:[('Eb4',.5),('F4',.5),('Eb4',.5),('Bb3',.5),('Eb4',2)],
 23:[(None,1),('Eb4',.5),('F4',.5),('Eb4',.5),('F4',.5),('Ab4',.5),('F4',.5)],
 24:[('Eb4',.5),('F4',.5),('Eb4',.5),('Db4',.5),('Bb3',2)],
 25:[('Bb3',4)],
 26:[('Ab4 F5',.5),('Gb5',.5),('Ab4 F5',.5),('C5',.5),('Ab4 F5',2)],
 27:[(None,1),('C5 F5',.5),('Db5 Gb5',.5),('C5 F5',.5),('Db5 Gb5',.5),('Bb5',.5),('Db5 F5',.5)],
 28:[('C5 F5',.5),('Db5 Gb5',.5),('C5 F5',.5),('C5',.5),('C5 Eb5',2)],
 29:[(None,1),('Bb5 Db6',1),('F5 C6',.5),('Ab5',.5),('F5 Ab5',1)],
 30:[('Gb4 Eb5',.5),('F5',.5),('Gb4 Eb5',.5),('Bb4',.5),('Gb4 Eb5',2)],
 31:[(None,1),('Bb4 Eb5',.5),('C5 F5',.5),('Bb4 Eb5',.5),('C5 F5',.5),('Ab5',.5),('C5 F5',.5)],
 32:[('Bb4 Eb5',.5),('C5 F5',.5),('Bb4 Eb5',.5),('Db5',.5),('F4 Bb4',2)],
 33:[('Bb4',4)],
}
bass={
 18:[('Gb3 Bb3',4)],19:[('Ab2 Eb3 Bb3',4)],20:[('Bb2 Db3 Bb3',4)],
 21:[('Bb2',1),('Bb3',1),('Ab3 C4',1),('Db3 F3',1)],
 22:[('Gb2 Gb3 Bb3',4)],23:[('Ab2 Eb3 Bb3',4)],24:[('Bb2 Db3 Bb3',4)],
 25:[('Bb2',.5),('Db3',.5),('Bb3',1),('Ab2',.5),('Eb3',.5),('Ab3',1)],
 26:[('Gb2',1),('Db3',1),('Db4 F4',2)],27:[('Ab2',1),('Eb3',1),('Bb3 Db4',2)],
 28:[('Bb2',1),('F3',1),('Bb3 Db4',2)],29:[('Bb2',1),('Bb3',1),('Ab3 C4',1),('Db3 F3',1)],
 30:[('Gb2',1),('Db3',1),('Eb4 Gb4',2)],31:[('Ab2',1),('Eb3',1),('Ab3 C4',2)],
 32:[('Bb2',1),('F3',1),('Bb3 Db4',2)],33:[('Bb3 Db4',1),('Bb2',1),('C3',1),('Db3',1)],
}
for hand in (main,bass):
    assert all(abs(sum(d for _,d in v)-4)<1e-8 for v in hand.values())

sections=[]
cursor=0.
for repeat in range(3):
    sections.append({'section':'opening, measures 1–16','start':cursor,'duration':32.})
    for i,p in enumerate(opening):
        for j,tone in enumerate(patterns[p].split()):
            note(tone,cursor+(i*3+j*.5)*quarter,.5,55+(j%3)*2,'right',i+1)
        if i+1 in opening_bass:
            pitches,beats=opening_bass[i+1]
            note(pitches,cursor+i*3*quarter,beats,39,'left',i+1)
    cursor+=32.
    sections.append({'section':'theme, measures 18–33','start':cursor,'duration':16*4*quarter})
    for measure in range(18,34):
        base=cursor+(measure-18)*4*quarter
        for hand,data,velocity in [('right',main,62),('left',bass,43)]:
            beat=0.
            for pitches,beats in data[measure]:
                # Preserve the two visible ties spanning measures 24–25 / 32–33.
                if hand=='right' and measure==24 and beat==2:
                    note(pitches,base+beat*quarter,6,velocity,hand,measure)
                elif hand=='right' and measure==25:
                    pass
                elif hand=='right' and measure==32 and beat==2:
                    note('F4',base+beat*quarter,2,velocity,hand,measure)
                    note('Bb4',base+beat*quarter,6,velocity,hand,measure)
                elif hand=='right' and measure==33:
                    pass
                elif pitches is not None:
                    note(pitches,base+beat*quarter,beats,velocity,hand,measure)
                beat+=beats
    cursor+=16*4*quarter
# An arranged cadence and five-second decay avoid cutting the piano mid-phrase.
note('Db3 Ab3 Db4 F4 Ab4',224,6,44,'left','arranged cadence')
events.sort(key=lambda e:(e['time'],0 if e['type']=='off' else 1,e['note']))
manifest={'source_image':str(SOURCE),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'composition':'Merry Christmas, Mr. Lawrence','composer':'Ryuichi Sakamoto',
 'kind':'New synthesized piano rendition of user-provided sheet-music excerpts',
 'selected_source_measures':'1–16 and 18–33; 8va observed in the opening; rests/fermata shortened for background arrangement',
 'arrangement':'Opening/theme repeated three times, then arranged closing cadence; not a complete score edition',
 'key':'D-flat major / B-flat minor','tempo_bpm':90,'duration_seconds':229,
 'sections':sections,'events':events,'notes':notes}
(OUT/'score-performance.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')

# Standard MIDI File, so the transcription is independently editable/auditionable.
def variable(value):
    data=[value&127];value>>=7
    while value:data.insert(0,(value&127)|128);value>>=7
    return bytes(data)
ticks=480
messages=[(0,b'\xff\x51\x03'+int(quarter*1000000).to_bytes(3,'big')),(0,b'\xc0\x00')]
for e in events:
    messages.append((round(e['time']/quarter*ticks),bytes([0x90 if e['type']=='on' else 0x80,e['note'],e['velocity']])))
messages.sort(key=lambda m:m[0])
track=bytearray();previous=0
for time,message in messages:track.extend(variable(time-previous)+message);previous=time
track.extend(b'\x00\xff\x2f\x00')
(OUT/'score-performance.mid').write_bytes(b'MThd'+struct.pack('>IHHH',6,0,1,ticks)+b'MTrk'+struct.pack('>I',len(track))+track)
print('Transcribed piano events:',len(events),'duration:',229,'seconds')
