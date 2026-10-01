import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShaderPreview } from "../../plugin/skills/shader-visual-kit/assets/preview/ShaderPreview";
import { demoCandidates } from "./candidates";

const lang = (new URLSearchParams(location.search).get("lang") ?? navigator.language)
  .toLowerCase()
  .startsWith("zh")
  ? "zh"
  : "en";
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
const copy = {
  zh: {
    title: "落地页背景：「流动的光」的五种读法",
    description: "演示内容。实际使用时，这里是 Agent 按你的描述准备的候选。",
    source: "源码",
  },
  en: {
    title: "Landing page background: five readings of “flowing light”",
    description: "Demo content. In real use, these are the candidates your agent prepares from your description.",
    source: "Source",
  },
}[lang];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShaderPreview
      lang={lang}
      title={copy.title}
      description={copy.description}
      candidates={demoCandidates(lang)}
      actions={
        <a href="https://github.com/Zane-0x5a/shader-visual-kit" target="_blank" rel="noreferrer">
          {copy.source} <span aria-hidden="true">↗</span>
        </a>
      }
    />
  </StrictMode>,
);
