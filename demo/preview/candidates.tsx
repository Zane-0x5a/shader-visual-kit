import {
  MeshGradient,
  NeuroNoise,
  SmokeRing,
  meshGradientPresets,
  neuroNoisePresets,
  smokeRingPresets,
} from "@paper-design/shaders-react";
import type { PreviewCandidate } from "../../plugin/skills/shader-visual-kit/assets/preview/ShaderPreview";

// Demo content for the preview page: five readings of one brief, written the way an agent would.
type Lang = "zh" | "en";
const common = { style: { width: "100%", height: "100%" }, minPixelRatio: 1, maxPixelCount: 2400000 };
const speed = (lang: Lang) => ({
  id: "speed",
  label: lang === "zh" ? "流动速度" : "Speed",
  min: 0,
  max: 2,
  step: 0.05,
  value: 1,
  unit: "×",
});
const detail = (label: string) => ({ id: "detail", label, min: 0, max: 1, step: 0.01, value: 0.5 });

function mesh(
  lang: Lang,
  copy: Record<Lang, [title: string, description: string]>,
  id: string,
  colors: string[],
  base: number,
  frame: number,
): PreviewCandidate {
  const [title, description] = copy[lang];
  return {
    id,
    title,
    subtitle: lang === "zh" ? "流动色彩" : "Flowing colour",
    description,
    effect: "MeshGradient",
    palette: colors,
    controls: [speed(lang), detail(lang === "zh" ? "色彩交融" : "Blend")],
    render: ({ playing, values }) => (
      <MeshGradient
        {...meshGradientPresets[0].params}
        {...common}
        speed={playing ? base * values.speed : 0}
        frame={frame}
        colors={colors}
        distortion={0.8}
        swirl={0.25 + values.detail * 0.8}
        grainOverlay={0.035}
      />
    ),
  };
}

export function demoCandidates(lang: Lang): PreviewCandidate[] {
  const zh = lang === "zh";
  const orbit = ["#e1ddd3", "#b5c3e8", "#949dd0"];
  const signal = ["#e4eaba", "#83ad70", "#0b2028"];
  return [
    mesh(
      lang,
      {
        zh: ["余晖", "暖橙、杏色与暮紫的大色块缓慢交融，铺满整个画面"],
        en: ["Afterglow", "Warm orange, apricot and dusk violet melt slowly across the whole frame"],
      },
      "afterglow",
      ["#29152e", "#ce624f", "#f3b78b", "#777baa"],
      0.32,
      8000,
    ),
    mesh(
      lang,
      {
        zh: ["静潮", "深青到浅绿的冷色块，像潮水一样缓慢推移"],
        en: ["Still tides", "Deep teal to pale green, drifting slowly like a tide"],
      },
      "tide",
      ["#052e3b", "#107b86", "#a7ddba", "#dbeacc"],
      0.2,
      5000,
    ),
    {
      id: "orbit",
      title: zh ? "光的轨道" : "Soft orbit",
      subtitle: zh ? "光与烟雾" : "Light and smoke",
      description: zh
        ? "暗底上一圈柔光烟环，中心留出空间放标题"
        : "A soft ring of light and smoke on dark, leaving the centre free for a headline",
      effect: "SmokeRing",
      palette: [...orbit, "#0c0c12"],
      controls: [speed(lang), detail(zh ? "烟雾厚度" : "Thickness")],
      render: ({ playing, values }) => (
        <SmokeRing
          {...smokeRingPresets[0].params}
          {...common}
          speed={playing ? 0.25 * values.speed : 0}
          frame={6000}
          colorBack="#0c0c12"
          colors={orbit}
          scale={0.85}
          thickness={0.25 + values.detail * 0.7}
          radius={0.3}
          noiseIterations={6}
          noiseScale={2.2}
        />
      ),
    },
    {
      id: "signal",
      title: zh ? "野生信号" : "Wild signal",
      subtitle: zh ? "有机纹理" : "Organic texture",
      description: zh
        ? "墨绿底上浅黄绿的有机网纹，像生长中的神经"
        : "Pale lime organic filaments on deep green, like growing nerves",
      effect: "NeuroNoise",
      palette: [signal[0], signal[1], "#163b39", signal[2]],
      controls: [speed(lang), detail(zh ? "纹理对比" : "Contrast")],
      render: ({ playing, values }) => (
        <NeuroNoise
          {...neuroNoisePresets[0].params}
          {...common}
          speed={playing ? 0.22 * values.speed : 0}
          frame={4000}
          colorFront={signal[0]}
          colorMid={signal[1]}
          colorBack={signal[2]}
          scale={0.85}
          brightness={0.06}
          contrast={0.18 + values.detail * 0.4}
        />
      ),
    },
    mesh(
      lang,
      {
        zh: ["虹彩", "靛蓝、紫与粉的珠光渐变，偏梦幻"],
        en: ["Iridescence", "Indigo, violet and pink in a pearly, dreamlike gradient"],
      },
      "iris",
      ["#272866", "#8361a5", "#e5b2ce", "#c6cbee"],
      0.28,
      13000,
    ),
  ];
}
