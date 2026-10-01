import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {MeshGradient} from '@paper-design/shaders-react';
import {Fixture} from '../remotion/Composition';
function App() {
  const [mounted, setMounted] = useState(true);
  const [kind, setKind] = useState<'mesh' | 'image'>('mesh');
  const [broken, setBroken] = useState(false);
  return <><button onClick={()=>setMounted(v=>!v)}>Mount / unmount</button>{' '}
  <button onClick={()=>setKind(v=>v==='mesh'?'image':'mesh')}>Switch effect</button>{' '}
  <button onClick={()=>{setKind('image');setBroken(v=>!v);}}>Toggle broken texture</button>
  <p>Native React web component</p><MeshGradient colors={['#201448','#f29d68','#4ec6b6']} speed={0} style={{width:320,height:180,maxWidth:'100%'}}/>
  <p>Remotion playback, scrubbing and resource readiness</p>{mounted && <Player component={Fixture} inputProps={{kind, imageUrl:broken?'/invalid-texture':'/texture.svg'}} durationInFrames={60} compositionWidth={320} compositionHeight={180} fps={30} controls style={{width:'min(640px, 100%)'}}/>}</>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
