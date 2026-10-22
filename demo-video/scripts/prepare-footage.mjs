import {root,media,probe,run} from './common.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const highResolution=process.argv.includes('--4k');
const folder=highResolution?'recordings-4k':'recordings';
const dir=path.join(root,'public/generated/production',folder);
const log=JSON.parse(await readFile(path.join(dir,'interaction-log.json'),'utf8'));
const source=path.join(dir,'walkthrough.webm');
const info=probe(source);
const video=info.streams.find(s=>s.codec_type==='video');
if(highResolution&&(video.width!==3840||video.height!==2160))throw Error('4K source dimensions missing');
const recorded=log.logs.filter(x=>x.event==='scene');
const lead=Number(info.format.duration)-recorded.at(-1).end;
if(lead<-.12||lead>4)throw new Error('Unexpected recording time offset '+lead);
const timeline=JSON.parse(await readFile('planning/timeline.json','utf8'));
const manifest={};
for(const scene of recorded){
 const target=path.join(dir,scene.id+'.mp4');
 const expected=timeline.find(x=>x.id===scene.id);
 if(!expected||!scene.verified)throw new Error('Unverified scene '+scene.id);
 run(media.ffmpeg,['-y','-hide_banner','-loglevel','error','-ss',String(Math.max(0,lead+scene.start)),'-i',source,'-t',String(expected.duration),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',target]);
 manifest[scene.id]={file:'generated/production/'+folder+'/'+scene.id+'.mp4',duration:expected.duration,recordingLeadSeconds:lead,sourceStart:lead+scene.start,verified:true,width:video.width,height:video.height};
 console.log('Prepared actual footage',scene.id);
}
await writeFile('planning/recording-manifest.json',JSON.stringify(manifest,null,2)+'\n');
