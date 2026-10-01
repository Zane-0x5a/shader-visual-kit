import React, {useState} from 'react';
import {Player} from '@remotion/player';
import {Artwork} from '@host/visual';

export function App() {
  const [mounted,setMounted] = useState(true);
  const [imageUrl,setImageUrl] = useState('/assets/texture.svg');
  return <main style={{maxWidth:720,margin:'24px auto',color:'#eee',background:'#18251e',padding:24}}>
    <h1>Texture Motion Study</h1>
    <button onClick={()=>setMounted(v=>!v)}>Mount / unmount</button>
    <button onClick={()=>setImageUrl(v=>v.includes('missing')?'/assets/texture.svg':'/assets/missing.svg')}>Toggle texture failure</button>
    {mounted && <Player component={Artwork} inputProps={{imageUrl}} durationInFrames={30}
      compositionWidth={320} compositionHeight={180} fps={30} controls style={{width:'100%'}}/>}
  </main>;
}
