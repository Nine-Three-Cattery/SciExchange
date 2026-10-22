import {root} from './common.mjs';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import timeline from '../planning/timeline.json' with {type:'json'};
const output=path.join(root,'output');await mkdir(output,{recursive:true});
if(!process.argv.includes('--stills'))await writeFile(path.join(root,'.local/render-progress.json'),JSON.stringify({percent:0,renderedFrames:0,encodedFrames:0,totalFrames:6870,width:3840,height:2160,status:'bundling'}));
const serveUrl=await bundle({entryPoint:path.join(root,'remotion/Root.tsx'),publicDir:path.join(root,'public')});
const composition=await selectComposition({serveUrl,id:'SciExchangeOSI'});
if(composition.durationInFrames/composition.fps>230)throw new Error('Production exceeds 230 seconds');
if(process.argv.includes('--stills')){
 for(const [name,id,fraction]of [['greeting','01-hook',.25],['hook','01-hook',.65],['idea','03-idea',.55],['workflow','04-workflow',.55],['demo','07-reject',.55],['signatures','10-first-pi',.55],['analytics','13-battery',.55],['market','16-market',.55],['closing','18-close',.55],['thanks','18-close',.88]]){const s=timeline.find(s=>s.id===id);const frame=s.from+Math.floor(s.frames*fraction);await renderStill({serveUrl,composition,scale:2,frame,output:path.join(output,'qa',name+'.png')});}
 await renderStill({serveUrl,composition,scale:2,frame:500,output:path.join(output,'thumbnail.png')});
}else{
 let last=-1;
 await renderMedia({serveUrl,composition,scale:2,imageFormat:'jpeg',jpegQuality:95,codec:'h264',audioCodec:'aac',audioBitrate:'256k',crf:17,x264Preset:'veryfast',pixelFormat:'yuv420p',concurrency:2,overwrite:true,outputLocation:path.join(output,'SciExchange_OSI_Hackathon_2026.mp4'),onProgress:p=>{const n=Math.floor(p.progress*100);if(n>=last+2){last=n;writeFile(path.join(root,'.local/render-progress.json'),JSON.stringify({percent:n,renderedFrames:p.renderedFrames,encodedFrames:p.encodedFrames,totalFrames:6870,width:3840,height:2160})).catch(()=>{});console.log('Render',n+'%',p.renderedFrames);}}});
 console.log('PRODUCTION RENDER COMPLETE');
}
