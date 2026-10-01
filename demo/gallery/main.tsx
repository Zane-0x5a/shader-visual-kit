import React, {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import type { PaperShaderElement } from "@paper-design/shaders";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Maximize,
  X,
  RotateCcw,
  Download,
  ArrowRight,
} from "lucide-react";
import { artworks, NativeArtwork } from "./artworks";
import "./gallery.css";

function Icon({
  name,
}: {
  name:
    | "play"
    | "pause"
    | "next"
    | "prev"
    | "tune"
    | "expand"
    | "close"
    | "reset"
    | "download"
    | "arrow";
}) {
  const Glyph = {
    play: Play,
    pause: Pause,
    next: ChevronRight,
    prev: ChevronLeft,
    tune: SlidersHorizontal,
    expand: Maximize,
    close: X,
    reset: RotateCcw,
    download: Download,
    arrow: ArrowRight,
  }[name];
  return <Glyph size={20} strokeWidth={1.5} aria-hidden="true" />;
}
class RenderBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="render-error" role="alert">
        <strong>画面暂时无法呈现</strong>
        <p>此效果需要 WebGL2，请确认浏览器已开启硬件加速。</p>
        <button onClick={() => location.reload()}>重新载入</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const id = React.useId();
  return (
    <div className="slider-field">
      <div>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value.toFixed(2)}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
function Gallery() {
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      artworks.findIndex((a) => a.id === location.hash.slice(1)),
    ),
  );
  const [playing, setPlaying] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [tuning, setTuning] = useState(false),
    [tempo, setTempo] = useState(1),
    [scale, setScale] = useState(1),
    [detail, setDetail] = useState(0.5);
  const [focus, setFocus] = useState(false),
    [message, setMessage] = useState(""),
    [renderError, setRenderError] = useState(""),
    [ready, setReady] = useState(false);
  const shader = useRef<PaperShaderElement>(null),
    tuneButton = useRef<HTMLButtonElement>(null),
    closeTune = useRef<HTMLButtonElement>(null);
  const artwork = artworks[selected],
    changed = tempo !== 1 || scale !== 1 || detail !== 0.5;
  function reset() {
    setTempo(1);
    setScale(1);
    setDetail(0.5);
  }
  function select(index: number) {
    setSelected((index + artworks.length) % artworks.length);
    reset();
    setMessage("");
  }
  useEffect(() => {
    history.replaceState(null, "", "#" + artwork.id);
  }, [artwork.id]);
  useEffect(() => {
    if (tuning) closeTune.current?.focus({ preventScroll: true });
  }, [tuning]);
  useEffect(() => {
    if (focus) window.scrollTo(0, 0);
  }, [focus]);
  useEffect(() => {
    const sync = () => {
      select(
        Math.max(
          0,
          artworks.findIndex((a) => a.id === location.hash.slice(1)),
        ),
      );
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocus(false);
        setTuning(false);
        tuneButton.current?.focus({ preventScroll: true });
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button,input,a,select,textarea")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
      if (e.key === "ArrowRight") select(selected + 1);
      if (e.key === "ArrowLeft") select(selected - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (query.matches) setPlaying(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setReady(false);
    setRenderError("");
    let raf = 0,
      canvas: HTMLCanvasElement | undefined;
    const start = performance.now();
    const lost = (e: Event) => {
      e.preventDefault();
      setRenderError("图形连接已中断，请重新载入画面。");
      setReady(false);
    };
    const check = () => {
      const mount = shader.current?.paperShaderMount;
      if (mount) {
        canvas = mount.canvasElement;
        canvas.addEventListener("webglcontextlost", lost);
        setReady(true);
        return;
      }
      if (performance.now() - start > 8000) {
        setRenderError("画面加载超时，请重新载入或检查 WebGL2 支持。");
        return;
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => {
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("webglcontextlost", lost);
    };
  }, [selected]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [message]);
  async function saveFrame() {
    try {
      const mount = shader.current?.paperShaderMount;
      if (!mount || !ready) throw new Error("not ready");
      mount.setFrame(mount.getCurrentFrame());
      const blob = await new Promise<Blob>((resolve, reject) =>
        mount.canvasElement.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("empty"))),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `${artwork.id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("当前画面已保存为 PNG");
    } catch {
      setMessage("暂时无法保存，请等待画面加载后重试。");
    }
  }
  return (
    <div className={`gallery ${focus ? "is-focused" : ""}`}>
      <header className="site-header">
        <a
          className="wordmark"
          href="#afterglow"
          onClick={(e) => {
            e.preventDefault();
            select(0);
          }}
          aria-label="Shader Gallery 首页"
        >
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          shader<span className="wordmark-light"> / gallery</span>
        </a>
        <span className="header-note">光、色彩，与一点想象。</span>
        <a className="source-link" href="https://github.com/Zane-0x5a/shader-visual-kit" target="_blank" rel="noreferrer">
          源码 <Icon name="arrow" />
        </a>
      </header>
      <main>
        <div className="gallery-heading">
          <div>
            <h1>流动的瞬间</h1>
            <p>每一幅，都有自己的节奏。</p>
          </div>
          <div className="collection-label">
            <span className="live-dot" />
            {artworks.length} 个精选效果
          </div>
        </div>
        <div className="viewing-room">
          <section className="stage" aria-label={`${artwork.name} 动态预览`}>
            <div className="artwork" key={artwork.id}>
              <RenderBoundary>
                <NativeArtwork
                  ref={shader}
                  artwork={artwork}
                  playing={playing}
                  tempo={tempo}
                  scale={scale}
                  detail={detail}
                />
              </RenderBoundary>
            </div>
            <div className="stage-top">
              <span className="art-position">
                {String(selected + 1).padStart(2, "0")}{" "}
                <span>/ {String(artworks.length).padStart(2, "0")}</span>
              </span>
              <div className="stage-actions">
                <button
                  ref={tuneButton}
                  aria-expanded={tuning}
                  aria-controls="tuning-panel"
                  onClick={() => setTuning((v) => !v)}
                >
                  <Icon name="tune" />
                  <span>微调</span>
                  {changed && <span className="changed-dot" />}
                </button>
                <button
                  className="icon-button"
                  title={focus ? "退出沉浸模式" : "沉浸模式"}
                  aria-label={focus ? "退出沉浸模式" : "沉浸模式"}
                  aria-pressed={focus}
                  onClick={() => setFocus((v) => !v)}
                >
                  <Icon name={focus ? "close" : "expand"} />
                </button>
              </div>
            </div>
            {!ready && !renderError && (
              <span className="loading-note" role="status">
                正在唤醒画面…
              </span>
            )}
            {renderError && (
              <div className="render-error" role="alert">
                <strong>画面暂时无法呈现</strong>
                <p>{renderError}</p>
                <button onClick={() => location.reload()}>重新载入</button>
              </div>
            )}
            <div className="stage-bottom">
              <div className="art-caption">
                <h2>{artwork.title}</h2>
                <p>
                  <span>{artwork.name}</span>
                  <span className="caption-divider" />
                  {artwork.subtitle}
                </p>
              </div>
              <button
                className="save-button"
                disabled={!ready}
                onClick={saveFrame}
                title="保存当前画面为 PNG"
              >
                <Icon name="download" />
                <span>留住这一帧</span>
              </button>
            </div>
            {message && (
              <div className="toast" role="status">
                {message}
              </div>
            )}
          </section>
          {tuning && (
            <aside
              className="tuning-panel"
              id="tuning-panel"
              aria-label="效果微调"
            >
              <div className="panel-heading">
                <h2>一点微调</h2>
                <button
                  ref={closeTune}
                  className="icon-button"
                  title="关闭微调"
                  aria-label="关闭微调"
                  onClick={() => {
                    setTuning(false);
                    tuneButton.current?.focus();
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
              <Slider
                label="流动速度"
                value={tempo}
                min={0}
                max={2}
                step={0.05}
                onChange={setTempo}
                unit="×"
              />
              <Slider
                label="画面尺度"
                value={scale}
                min={0.6}
                max={1.6}
                step={0.05}
                onChange={setScale}
                unit="×"
              />
              <Slider
                label={
                  artwork.id === "orbit"
                    ? "烟雾厚度"
                    : artwork.id === "signal"
                      ? "纹理对比"
                      : "色彩交融"
                }
                value={detail}
                min={0}
                max={1}
                step={0.01}
                onChange={setDetail}
              />
              <div className="palette-label">此刻的配色</div>
              <div className="palette">
                {artwork.colors.map((color) => (
                  <span
                    key={color}
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
              <button
                className="reset-button"
                onClick={reset}
                disabled={!changed}
              >
                <Icon name="reset" />
                恢复精选设置
              </button>
            </aside>
          )}
        </div>
        <div className="transport">
          <div className="medium">
            <span>{artwork.medium}</span>
            <span className="native-name">{artwork.type}</span>
          </div>
          <div className="playback">
            <button
              className="icon-button"
              title="上一个效果"
              aria-label="上一个效果"
              onClick={() => select(selected - 1)}
            >
              <Icon name="prev" />
            </button>
            <button
              className="play-button"
              title={playing ? "暂停动画" : "播放动画"}
              aria-label={playing ? "暂停动画" : "播放动画"}
              onClick={() => setPlaying((v) => !v)}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button
              className="icon-button"
              title="下一个效果"
              aria-label="下一个效果"
              onClick={() => select(selected + 1)}
            >
              <Icon name="next" />
            </button>
            <span className="play-status">
              {playing && tempo > 0 ? "缓缓流动中" : "停在这一刻"}
            </span>
          </div>
          <span className="powered">Paper Shaders · WebGL</span>
        </div>
        <section className="collection" aria-label="精选效果">
          <div className="collection-heading">
            <h2>换一种心境</h2>
            <p>光影没有标准答案。</p>
          </div>
          <div className="filmstrip">
            {artworks.map((item, index) => (
              <button
                key={item.id}
                className={`art-tile ${selected === index ? "selected" : ""}`}
                aria-label={`查看${item.name}`}
                aria-pressed={selected === index}
                onClick={() => select(index)}
              >
                <span className="thumbnail" aria-hidden="true">
                  <RenderBoundary>
                    <NativeArtwork artwork={item} thumbnail />
                  </RenderBoundary>
                  <span className="tile-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {selected === index && (
                    <span className="tile-active">正在展映</span>
                  )}
                </span>
                <span className="tile-info">
                  <span>{item.name}</span>
                  <span>{item.title}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          Shader Visual Kit <span className="footer-separator">/</span>{" "}
          精选视觉练习
        </span>
        <span>光在流动，灵感也是。</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Gallery />
  </React.StrictMode>,
);
