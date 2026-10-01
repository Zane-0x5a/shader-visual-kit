import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Artwork} from '@host/visual';
registerRoot(()=> <Composition id="Study" component={Artwork} width={320} height={180} durationInFrames={30} fps={30}/>);
