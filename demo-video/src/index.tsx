import React from 'react';
import {AbsoluteFill, Audio, Composition, OffthreadVideo, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';

type Props = {title: string; footage: string | null; audio: string | null};
const Check: React.FC<Props> = ({title, footage, audio}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: '#07131f', color: '#edf7ff', fontFamily: 'Arial, sans-serif'}}>
    {footage && <OffthreadVideo muted src={staticFile(footage)} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35}} />}
    <AbsoluteFill style={{justifyContent: 'center', padding: 120, opacity: interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'})}}>
      <div style={{color: '#67e8f9', fontSize: 30, letterSpacing: 8}}>SCIEXCHANGE · VIDEO TOOLCHAIN</div>
      <h1 style={{fontSize: 88, margin: '30px 0'}}>{title}</h1>
      <div style={{fontSize: 34, color: '#b7c9da'}}>Playwright → FFmpeg → Remotion · 1920 × 1080 / 30 fps</div>
      <div style={{fontSize: 26, marginTop: 70, color: '#8da3b8'}}>环境测试画面 · 测试音不是高松灯配音 · 非实验数据</div>
    </AbsoluteFill>
    {audio && <Audio src={staticFile(audio)} />}
  </AbsoluteFill>;
};

const Root: React.FC = () => <Composition id="EnvironmentCheck" component={Check} width={1920} height={1080} fps={30} durationInFrames={90} defaultProps={{title: '视频环境自检', footage: null, audio: null}} />;
registerRoot(Root);
