import {root} from './common.mjs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
function run(command,args){const p=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(p.error)throw p.error;if(p.status!==0)throw Error(command+' exited '+p.status);}
run(path.join(root,'.local/tts-venv/bin/python'),['assets/music/from_score.py']);
run('swiftc',['-module-cache-path','.local/swift-module-cache','assets/music/render_piano.swift','-o','.local/render-piano']);
run(path.join(root,'.local/render-piano'),['public/generated/production/music/score-performance.json','public/generated/production/music/score-piano.wav']);
