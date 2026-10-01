import {Composition, Sequence, registerRoot} from 'remotion';
import {Fixture} from './Composition';
import {WaterFixture} from './Water';
const Sequenced = () => <Sequence from={10}><Fixture/></Sequence>;
const Root = () => <><Composition id="PaperFixture" component={Fixture} width={320} height={180} fps={30} durationInFrames={60}/>
<Composition id="WaterFixture" component={WaterFixture} width={128} height={128} fps={30} durationInFrames={60}/>
<Composition id="SequenceFixture" component={Sequenced} width={320} height={180} fps={30} durationInFrames={60}/></>;
registerRoot(Root);
