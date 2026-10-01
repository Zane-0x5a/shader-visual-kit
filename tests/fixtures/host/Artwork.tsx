import React, {useMemo} from 'react';
import {staticFile, useCurrentFrame} from 'remotion';
import {imageDitheringFragmentShader, getShaderColorFromString, ShaderFitOptions} from '@paper-design/shaders';
import {PaperFrame} from './PaperFrame';

export function Artwork({imageUrl = staticFile('assets/texture.svg')}: {imageUrl?: string}) {
  const frame=useCurrentFrame();
  const uniforms=useMemo(()=>({
    u_image:imageUrl,u_fit:ShaderFitOptions.cover,u_scale:1,u_rotation:0,u_offsetX:0,u_offsetY:0,
    u_originX:.5,u_originY:.5,u_worldWidth:0,u_worldHeight:0,
    u_colorFront:getShaderColorFromString('#ffffff'),u_colorBack:getShaderColorFromString('#000000'),
    u_colorHighlight:getShaderColorFromString('#eeeeee'),u_type:3,u_pxSize:2,u_colorSteps:5,u_originalColors:true,u_inverted:false,
  }),[imageUrl]);
  return <PaperFrame fragmentShader={imageDitheringFragmentShader} uniforms={uniforms}
    timeMs={frame/30*1000} style={{width:320,height:180}}/>;
}
