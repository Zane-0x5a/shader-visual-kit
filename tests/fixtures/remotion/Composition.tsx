import {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {meshGradientFragmentShader, imageDitheringFragmentShader, getShaderColorFromString, ShaderFitOptions} from '@paper-design/shaders';
import {PaperFrame} from '../../../plugin/skills/shader-visual-kit/assets/PaperFrame';

export type FixtureProps = {kind?: 'mesh' | 'image' | 'invalid'; imageUrl?: string; otherImageUrl?: string; rate?: number; initialMs?: number; zeroSize?: boolean; maxPixelCount?: number};
const sizing = {u_fit: ShaderFitOptions.cover, u_scale: 1, u_rotation: 0, u_offsetX: 0, u_offsetY: 0, u_originX: .5, u_originY: .5, u_worldWidth: 0, u_worldHeight: 0};
export const Fixture = ({kind = 'mesh', imageUrl = '', otherImageUrl, rate = 1, initialMs = 0, zeroSize = false, maxPixelCount}: FixtureProps) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const image = otherImageUrl && frame >= 10 ? otherImageUrl : imageUrl;
  const uniforms = useMemo(() => kind === 'image' ? {
    ...sizing, u_image: image, u_colorFront: getShaderColorFromString('#ffffff'),
    u_colorBack: getShaderColorFromString('#000000'), u_colorHighlight: getShaderColorFromString('#eeeeee'),
    u_type: 3, u_pxSize: 2, u_colorSteps: 5, u_originalColors: true, u_inverted: false,
  } : {
    ...sizing, u_colors: ['#231648','#e77842','#45aaa3'].map(getShaderColorFromString),
    u_colorsCount: 3, u_distortion: .8, u_swirl: .7, u_grainMixer: 0, u_grainOverlay: 0,
  }, [kind, image]);
  return <AbsoluteFill><PaperFrame fragmentShader={kind === 'invalid' ? 'invalid shader' : kind === 'image' ? imageDitheringFragmentShader : meshGradientFragmentShader}
    uniforms={uniforms} timeMs={initialMs + frame / fps * 1000 * rate} maxPixelCount={maxPixelCount} style={zeroSize ? {width: 0, height: 0} : {width, height}}/></AbsoluteFill>;
};
