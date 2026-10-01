import { createRoot } from "react-dom/client";
import { MeshGradient, SmokeRing } from "@paper-design/shaders-react";
import {
  ShaderPreview,
  type PreviewCandidate,
} from "../../../plugin/skills/shader-visual-kit/assets/preview/ShaderPreview";

// The effect as a fixed page background behind host markup, shown in its layout.
const inContext: PreviewCandidate = {
  id: "in-context",
  title: "In context",
  effect: "MeshGradient",
  description: "The host hero with the effect as a fixed page background",
  layout: true,
  render: ({ playing }) => (
    <section className="host-hero">
      <MeshGradient
        style={{ position: "fixed", inset: 0, zIndex: -1 }}
        colors={["#1b2a49", "#4f7cac", "#c0e0de"]}
        speed={playing ? 0.4 : 0}
      />
      <h2 className="host-title">Host headline</h2>
      <button className="host-button">Host button</button>
    </section>
  ),
};
const layered: PreviewCandidate = {
  id: "layered",
  title: "Layered",
  effect: "MeshGradient + SmokeRing",
  controls: [{ id: "speed", label: "Speed", min: 0, max: 2, step: 0.1, value: 1 }],
  render: ({ playing, values }) => (
    <div style={{ position: "relative" }}>
      <MeshGradient
        style={{ position: "absolute", inset: 0 }}
        colors={["#2a1d3a", "#8a4f7d"]}
        speed={playing ? 0.3 * values.speed : 0}
      />
      <SmokeRing
        style={{ position: "absolute", left: "25%", top: "25%", width: "50%", height: "50%" }}
        colorBack="#00000000"
        colors={["#ffe9b0"]}
        speed={playing ? 0.3 * values.speed : 0}
      />
    </div>
  ),
};
const broken: PreviewCandidate = {
  id: "broken",
  title: "Broken",
  render: () => {
    throw new Error("fixture: intentional render failure");
  },
};

const single = new URLSearchParams(location.search).has("single");
createRoot(document.getElementById("root")!).render(
  <ShaderPreview
    lang="en"
    title="Preview page fixture"
    candidates={single ? [inContext] : [inContext, layered, broken]}
  />,
);
