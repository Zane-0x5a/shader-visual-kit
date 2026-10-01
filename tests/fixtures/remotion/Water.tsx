import {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {ShaderMount, ShaderFitOptions, getShaderColorFromString, waterFragmentShader} from '@paper-design/shaders';
import {PaperFrame} from '../../../plugin/skills/shader-visual-kit/assets/PaperFrame';

export type WaterProps = {imageUrl?: string; native?: boolean; noMipmaps?: boolean; switchMipmaps?: boolean};

// Independent native reference for the official Water defaults in Paper 0.0.81.
export function WaterFixture({imageUrl = '', native = false, noMipmaps = false, switchMipmaps = false}: WaterProps) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLDivElement>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const uniforms = useMemo(() => ({
    u_image: imageUrl, u_colorBack: getShaderColorFromString('#909090'), u_colorHighlight: getShaderColorFromString('#ffffff'),
    u_highlights: .07, u_layering: .5, u_edges: .8, u_waves: .3, u_caustic: .1, u_size: 1,
    u_fit: ShaderFitOptions.cover, u_scale: .8, u_rotation: 0, u_offsetX: 0, u_offsetY: 0,
    u_originX: .5, u_originY: .5, u_worldWidth: 0, u_worldHeight: 0,
  }), [imageUrl]);
  useLayoutEffect(() => {
    if (!native) return;
    const handle = delayRender('Native Water reference');
    let disposed = false;
    let mount: ShaderMount | undefined;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageUrl;
    void image.decode().then(async () => {
      if (disposed) return;
      mount = new ShaderMount(ref.current!, waterFragmentShader, {...uniforms, u_image: image},
        {preserveDrawingBuffer: true}, 0, 1000, 1, width * height, ['u_image']);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (disposed) return;
      mount.setFrame(1000);
      mount.canvasElement.getContext('webgl2')!.finish();
      continueRender(handle);
    }).catch(cancelRender);
    return () => {disposed = true; mount?.dispose(); continueRender(handle);};
  }, [native, imageUrl, uniforms, width, height, delayRender, continueRender, cancelRender]);
  const mipmaps = noMipmaps || (switchMipmaps && frame < 10) ? [] : ['u_image'];
  return <AbsoluteFill>{native ? <div ref={ref} style={{width, height}}/> :
    <PaperFrame fragmentShader={waterFragmentShader} uniforms={uniforms} timeMs={1000}
      mipmaps={mipmaps} maxPixelCount={width * height} style={{width, height}}/>}</AbsoluteFill>;
}
