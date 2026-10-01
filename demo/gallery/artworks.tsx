import { forwardRef } from "react";
import {
  MeshGradient,
  NeuroNoise,
  SmokeRing,
  meshGradientPresets,
  neuroNoisePresets,
  smokeRingPresets,
} from "@paper-design/shaders-react";
import type { PaperShaderElement } from "@paper-design/shaders";

// Curated native props for this gallery, not a registry of supported effects.
export const artworks = [
  {
    id: "afterglow",
    title: "Afterglow",
    name: "余晖",
    subtitle: "让最后一束光，再多停留一会儿。",
    type: "Mesh Gradient",
    medium: "流动色彩",
    colors: ["#29152e", "#ce624f", "#f3b78b", "#777baa"],
    speed: 0.32,
    frame: 8000,
  },
  {
    id: "tide",
    title: "Still tides",
    name: "静潮",
    subtitle: "蓝与绿之间，是一片没有边界的海。",
    type: "Mesh Gradient",
    medium: "流动色彩",
    colors: ["#052e3b", "#107b86", "#a7ddba", "#dbeacc"],
    speed: 0.2,
    frame: 5000,
  },
  {
    id: "orbit",
    title: "Soft orbit",
    name: "光的轨道",
    subtitle: "没有起点，也不急着到达终点。",
    type: "Smoke Ring",
    medium: "光与烟雾",
    colors: ["#e1ddd3", "#b5c3e8", "#949dd0", "#0c0c12"],
    speed: 0.25,
    frame: 6000,
  },
  {
    id: "signal",
    title: "Wild signal",
    name: "野生信号",
    subtitle: "秩序之外，藏着另一种生长。",
    type: "Neuro Noise",
    medium: "有机纹理",
    colors: ["#e4eaba", "#83ad70", "#163b39", "#0b2028"],
    speed: 0.22,
    frame: 4000,
  },
  {
    id: "iris",
    title: "Iridescence",
    name: "虹彩",
    subtitle: "介于梦境与醒来之前的颜色。",
    type: "Mesh Gradient",
    medium: "流动色彩",
    colors: ["#272866", "#8361a5", "#e5b2ce", "#c6cbee"],
    speed: 0.28,
    frame: 13000,
  },
] as const;
export type Artwork = (typeof artworks)[number];
export const NativeArtwork = forwardRef<
  PaperShaderElement,
  {
    artwork: Artwork;
    playing?: boolean;
    tempo?: number;
    scale?: number;
    detail?: number;
    thumbnail?: boolean;
  }
>(
  (
    {
      artwork,
      playing = false,
      tempo = 1,
      scale = 1,
      detail = 0.5,
      thumbnail = false,
    },
    ref,
  ) => {
    const common = {
      ref,
      style: { width: "100%", height: "100%" },
      minPixelRatio: 1,
      maxPixelCount: thumbnail ? 120000 : 2400000,
      webGlContextAttributes: { preserveDrawingBuffer: true },
      speed: playing ? artwork.speed * tempo : 0,
      frame: artwork.frame,
    };
    if (artwork.id === "orbit")
      return (
        <SmokeRing
          {...smokeRingPresets[0].params}
          {...common}
          colorBack="#0c0c12"
          colors={artwork.colors.slice(0, 3)}
          scale={0.85 * scale}
          thickness={0.25 + detail * 0.7}
          radius={0.3}
          noiseIterations={6}
          noiseScale={2.2}
        />
      );
    if (artwork.id === "signal")
      return (
        <NeuroNoise
          {...neuroNoisePresets[0].params}
          {...common}
          colorFront={artwork.colors[0]}
          colorMid={artwork.colors[1]}
          colorBack={artwork.colors[3]}
          scale={0.85 * scale}
          brightness={0.06}
          contrast={0.18 + detail * 0.4}
        />
      );
    return (
      <MeshGradient
        {...meshGradientPresets[0].params}
        {...common}
        colors={[...artwork.colors]}
        scale={scale}
        distortion={0.8}
        swirl={0.25 + detail * 0.8}
        grainOverlay={0.035}
      />
    );
  },
);
NativeArtwork.displayName = "NativeArtwork";
