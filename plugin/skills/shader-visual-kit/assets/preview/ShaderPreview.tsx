"use client";
/**
 * Shader Visual Kit preview page: the current task's Paper candidates on one page, for the user to
 * compare, adjust a little and pick. Copy this folder into a dev-only entry of the host, or into a
 * task-local preview project. It needs only React; candidates render with the host's own Paper.
 *
 *   <ShaderPreview lang="zh" title="首页背景：光影的两种读法" candidates={[{
 *     id: "rays", title: "光束", effect: "GodRays", description: "从左上角斜射进来的一束暖光",
 *     controls: [{ id: "speed", label: "流动速度", min: 0, max: 2, step: 0.05, value: 1, unit: "×" }],
 *     render: ({ playing, values }) => <GodRays {...rays} speed={playing ? 0.6 * values.speed : 0} />,
 *   }]} />
 *
 * The URL hash holds the shown candidate and its changed values (#rays&speed=1.4); "Copy choice"
 * puts the same on the clipboard in words, for the user to paste back to the agent.
 */
import {
  Component,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./ShaderPreview.css";

export type PreviewControl = {
  /** Key in `values` and in the URL hash. */
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** The recommended value; reset returns here. */
  value: number;
  unit?: string;
};

export type PreviewCandidate = {
  /** URL-safe; appears in the hash and in the copied choice. */
  id: string;
  /** Short name, set large over the stage. */
  title: string;
  subtitle?: string;
  /** One sentence on what this reading looks like. */
  description?: string;
  /** Native Paper component name, e.g. "MeshGradient". */
  effect?: string;
  palette?: string[];
  /**
   * Set when `render` returns host layout with content over the effect: the stage then shows it
   * untouched, without the caption shade, and the caption moves below the stage.
   */
  layout?: boolean;
  /** One or two adjustments that matter for the choice. */
  controls?: PreviewControl[];
  /** Pause by passing speed 0 while `playing` is false. Thumbnails render paused and small: return the effect alone there. */
  render: (state: {
    playing: boolean;
    thumbnail: boolean;
    values: Record<string, number>;
  }) => ReactNode;
};

type Choice = { label: string; value: string; recommended: string };
const zh = {
  home: "回到第一个候选",
  count: (n: number) => `${n} 个候选`,
  stage: (title: string) => `${title} 动态预览`,
  tune: "微调",
  closeTune: "关闭微调",
  enter: "沉浸模式",
  exit: "退出沉浸模式",
  loading: "正在加载画面…",
  errorTitle: "画面无法呈现",
  crashed: "候选渲染出错：",
  timeout:
    "8 秒内没有出现 Paper 画布。请确认候选渲染了 Paper 组件，且浏览器开启了 WebGL2 硬件加速。",
  lost: "图形上下文已丢失，请重新载入。",
  reload: "重新载入",
  save: "保存当前帧",
  saveTitle: "把当前画面保存为 PNG",
  saved: "当前帧已保存为 PNG",
  saveFailed: "暂时无法保存，请等画面加载后重试。",
  copy: "复制选择",
  copyTitle: "复制当前候选和微调值，粘贴给 Agent",
  copied: "已复制，粘贴给 Agent 即可",
  copyFailed: "无法写入剪贴板，请手动复制：",
  prev: "上一个候选",
  next: "下一个候选",
  play: "播放动画",
  pause: "暂停动画",
  playing: "播放中",
  paused: "已暂停",
  palette: "配色",
  reset: "恢复推荐值",
  candidates: "候选",
  hint: "← → 切换　空格 播放 / 暂停",
  current: "当前",
  view: (title: string) => `查看${title}`,
  choice: (title: string, id: string, changed: Choice[]) =>
    `候选「${title}」(${id})` +
    (changed.length
      ? `；${changed.map((c) => `${c.label} ${c.value}（推荐 ${c.recommended}）`).join("，")}`
      : "，使用推荐值"),
};
const labels: Record<"zh" | "en", typeof zh> = {
  zh,
  en: {
    home: "Back to the first candidate",
    count: (n) => `${n} candidate${n === 1 ? "" : "s"}`,
    stage: (title) => `${title}, live preview`,
    tune: "Adjust",
    closeTune: "Close adjustments",
    enter: "Immersive view",
    exit: "Exit immersive view",
    loading: "Loading the picture…",
    errorTitle: "The picture can't be shown",
    crashed: "The candidate failed to render: ",
    timeout:
      "No Paper canvas appeared within 8 seconds. Check that the candidate renders a Paper component and that WebGL2 hardware acceleration is on.",
    lost: "The graphics context was lost. Reload to continue.",
    reload: "Reload",
    save: "Save frame",
    saveTitle: "Save the current picture as PNG",
    saved: "Frame saved as PNG",
    saveFailed: "Can't save yet. Wait for the picture to load and try again.",
    copy: "Copy choice",
    copyTitle: "Copy this candidate and its adjustments to paste to your agent",
    copied: "Copied. Paste it to your agent",
    copyFailed: "Couldn't write to the clipboard. Copy this by hand: ",
    prev: "Previous candidate",
    next: "Next candidate",
    play: "Play animation",
    pause: "Pause animation",
    playing: "Playing",
    paused: "Paused",
    palette: "Palette",
    reset: "Restore recommended values",
    candidates: "Candidates",
    hint: "← → switch   Space play / pause",
    current: "Showing",
    view: (title) => `View ${title}`,
    choice: (title, id, changed) =>
      `Candidate "${title}" (${id})` +
      (changed.length
        ? `; ${changed.map((c) => `${c.label} ${c.value} (recommended ${c.recommended})`).join(", ")}`
        : ", recommended values"),
  },
};

const paths = {
  play: <path d="M8 5.5v13l10-6.5z" />,
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  prev: <path d="m14.5 6-6 6 6 6" />,
  next: <path d="m9.5 6 6 6-6 6" />,
  tune: <path d="M4 8h9m4 0h3M4 16h3m4 0h9M15 6v4M9 14v4" />,
  expand: <path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  reset: <path d="M4.5 13a7.5 7.5 0 1 0 2.2-6.3L4.5 9m0-4.5V9H9" />,
  download: <path d="M12 4v11m-5-5 5 5 5-5M5 19.5h14" />,
  copy: <path d="M9 9h10v10H9zm6 0V5H5v10h4" />,
};
function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

type Mount = {
  canvasElement: HTMLCanvasElement;
  getCurrentFrame(): number;
  setFrame(ms: number): void;
};
const shaders = (root: Element | null) => [
  ...(root?.querySelectorAll<HTMLElement & { paperShaderMount?: Mount }>(
    "[data-paper-shader]",
  ) ?? []),
];
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
const pad = (n: number) => String(n).padStart(2, "0");
const format = (control: PreviewControl, value: number) =>
  value.toFixed((String(control.step).split(".")[1] ?? "").length) +
  (control.unit ?? "");
const decode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};
// Thumbnails show host markup too; keep its links and buttons out of the tab order.
const inert = (element: HTMLElement | null) =>
  element?.setAttribute("inert", "");

// Layers are drawn in document order; CSS blending and host markup are left out.
function flatten(box: HTMLElement, mounts: Mount[]) {
  const frame = box.getBoundingClientRect(),
    scale = devicePixelRatio,
    canvas = document.createElement("canvas");
  canvas.width = Math.round(frame.width * scale);
  canvas.height = Math.round(frame.height * scale);
  const context = canvas.getContext("2d")!;
  for (const { canvasElement: layer } of mounts) {
    const rect = layer.getBoundingClientRect();
    context.drawImage(
      layer,
      (rect.left - frame.left) * scale,
      (rect.top - frame.top) * scale,
      rect.width * scale,
      rect.height * scale,
    );
  }
  return canvas;
}

class RenderBoundary extends Component<
  { children: ReactNode; onError?: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(
      error instanceof Error ? error.message : String(error),
    );
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Called as a component, so a throwing candidate stays inside its RenderBoundary.
function Candidate({
  candidate,
  state,
}: {
  candidate: PreviewCandidate;
  state: Parameters<PreviewCandidate["render"]>[0];
}) {
  return <>{candidate.render(state)}</>;
}

function Slider({
  control,
  value,
  onChange,
}: {
  control: PreviewControl;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="sp-slider">
      <div>
        <label htmlFor={id}>{control.label}</label>
        <output htmlFor={id}>{format(control, value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ShaderPreview({
  lang,
  title,
  description,
  candidates,
  actions,
}: {
  lang: "zh" | "en";
  title: string;
  description?: string;
  candidates: PreviewCandidate[];
  /** Header slot, e.g. a link to the real page. */
  actions?: ReactNode;
}) {
  if (!candidates.length)
    throw new Error("ShaderPreview needs at least one candidate");
  const t = labels[lang];
  const [selected, setSelected] = useState(0);
  const [tweaks, setTweaks] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const [playing, setPlaying] = useState(true);
  const [tuning, setTuning] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [message, setMessage] = useState({ text: "", ms: 0 });
  const [renderError, setRenderError] = useState("");
  const [ready, setReady] = useState(false);
  const [hashRead, setHashRead] = useState(false);
  const content = useRef<HTMLDivElement>(null),
    tuneButton = useRef<HTMLButtonElement>(null),
    closeTune = useRef<HTMLButtonElement>(null),
    failure = useRef<{ id: string } | null>(null),
    latest = useRef(candidates);
  latest.current = candidates;
  const panelId = useId();
  const candidate = candidates[selected] ?? candidates[0];
  const valuesOf = (item: PreviewCandidate) =>
    Object.fromEntries(
      (item.controls ?? []).map((c) => [
        c.id,
        tweaks[item.id]?.[c.id] ?? c.value,
      ]),
    );
  const changedOf = (item: PreviewCandidate) => {
    const values = valuesOf(item);
    return (item.controls ?? []).filter((c) => values[c.id] !== c.value);
  };
  const values = valuesOf(candidate),
    changed = changedOf(candidate);
  const hash = [
    candidate.id,
    ...changed.map((c) => `${c.id}=${values[c.id]}`),
  ].join("&");
  const many = candidates.length > 1,
    adjustable = !!(candidate.controls?.length || candidate.palette?.length);

  function select(index: number) {
    setSelected((index + candidates.length) % candidates.length);
    setMessage({ text: "", ms: 0 });
  }
  function setValue(id: string, value: number) {
    setTweaks((all) => ({
      ...all,
      [candidate.id]: { ...all[candidate.id], [id]: value },
    }));
  }
  function reset() {
    setTweaks((all) => ({ ...all, [candidate.id]: {} }));
  }
  // The hash is read before paint, so a link to a candidate never flashes the first one.
  useIsomorphicLayoutEffect(() => {
    const read = () => {
      const [id, ...pairs] = location.hash.slice(1).split("&").map(decode);
      const index = latest.current.findIndex((item) => item.id === id);
      if (index < 0) return;
      const item = latest.current[index],
        next: Record<string, number> = {};
      for (const pair of pairs) {
        const [key, raw = ""] = pair.split("=");
        const control = item.controls?.find((c) => c.id === key),
          value = Number(raw);
        if (control && raw && Number.isFinite(value))
          next[key] = Math.min(control.max, Math.max(control.min, value));
      }
      setSelected(index);
      setTweaks((all) => ({ ...all, [item.id]: next }));
    };
    read();
    setHashRead(true);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPlaying(false);
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (hashRead && location.hash !== `#${hash}`)
      history.replaceState(history.state, "", `#${hash}`);
  }, [hash, hashRead]);
  useEffect(() => {
    if (tuning) closeTune.current?.focus({ preventScroll: true });
  }, [tuning]);
  useEffect(() => {
    if (immersive) window.scrollTo(0, 0);
  }, [immersive]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImmersive(false);
        setTuning(false);
        tuneButton.current?.focus({ preventScroll: true });
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest(
          "button,input,a,select,textarea,[contenteditable],.sp-content",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
      if (e.key === "ArrowRight" && many) select(selected + 1);
      if (e.key === "ArrowLeft" && many) select(selected - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, many]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (query.matches) setPlaying(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // A throwing candidate reports during this same commit; keep its error.
    if (failure.current?.id === candidate.id) return;
    failure.current = null;
    setReady(false);
    setRenderError("");
    let raf = 0;
    const canvases: HTMLCanvasElement[] = [];
    const start = performance.now();
    const lost = (e: Event) => {
      e.preventDefault();
      setRenderError(t.lost);
      setReady(false);
    };
    const check = () => {
      if (failure.current) return;
      const found = shaders(content.current);
      if (found.length && found.every((element) => element.paperShaderMount)) {
        for (const element of found) {
          const canvas = element.paperShaderMount!.canvasElement;
          canvas.addEventListener("webglcontextlost", lost);
          canvases.push(canvas);
        }
        setReady(true);
        return;
      }
      if (performance.now() - start > 8000) {
        setRenderError(t.timeout);
        return;
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => {
      cancelAnimationFrame(raf);
      for (const canvas of canvases)
        canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [candidate.id, t]);
  useEffect(() => {
    if (!message.text) return;
    const timeout = setTimeout(
      () => setMessage({ text: "", ms: 0 }),
      message.ms,
    );
    return () => clearTimeout(timeout);
  }, [message]);

  async function saveFrame() {
    try {
      const mounts = shaders(content.current).flatMap(
        (element) => element.paperShaderMount ?? [],
      );
      if (!ready || !mounts.length) throw new Error("not ready");
      // Paper renders synchronously here, so the canvases read back without preserveDrawingBuffer.
      for (const mount of mounts) mount.setFrame(mount.getCurrentFrame());
      const image =
        mounts.length === 1
          ? mounts[0].canvasElement
          : flatten(content.current!, mounts);
      const blob = await new Promise<Blob>((resolve, reject) =>
        image.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("empty"))),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `${candidate.id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: t.saved, ms: 4000 });
    } catch {
      setMessage({ text: t.saveFailed, ms: 4000 });
    }
  }
  async function copyChoice() {
    const text = t.choice(
      candidate.title,
      candidate.id,
      changed.map((c) => ({
        label: c.label,
        value: format(c, values[c.id]),
        recommended: format(c, c.value),
      })),
    );
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ text: t.copied, ms: 4000 });
    } catch {
      setMessage({ text: t.copyFailed + text, ms: 15000 });
    }
  }

  const caption = (
    <>
      <h2>{candidate.title}</h2>
      {(candidate.subtitle || candidate.description) && (
        <p>
          {candidate.subtitle && <span>{candidate.subtitle}</span>}
          {candidate.subtitle && candidate.description && (
            <span className="sp-divider" />
          )}
          {candidate.description}
        </p>
      )}
    </>
  );
  const tools = (
    <div className="sp-tools">
      <button
        className="sp-button sp-text-button"
        onClick={copyChoice}
        title={t.copyTitle}
      >
        <Icon name="copy" />
        <span>{t.copy}</span>
      </button>
      <button
        className="sp-button sp-text-button"
        disabled={!ready}
        onClick={saveFrame}
        title={t.saveTitle}
      >
        <Icon name="download" />
        <span>{t.save}</span>
      </button>
    </div>
  );

  return (
    <div className={`sp-root${immersive ? " is-immersive" : ""}`}>
      <div className="sp-page">
        <header className="sp-header sp-ui">
          <button
            className="sp-button sp-wordmark"
            onClick={() => select(0)}
            aria-label={t.home}
          >
            <span className="sp-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            shader<span className="sp-wordmark-light">{" / preview"}</span>
          </button>
          {actions && <div className="sp-actions">{actions}</div>}
        </header>
        <main>
          <div className="sp-heading sp-ui">
            <div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            <div className="sp-count">
              <span className="sp-dot" />
              {t.count(candidates.length)}
            </div>
          </div>
          <div className="sp-room">
            <div className="sp-column">
              <section
                className={`sp-stage${candidate.layout ? " is-layout" : ""}`}
                aria-label={t.stage(candidate.title)}
              >
                <div className="sp-content" key={candidate.id} ref={content}>
                  <RenderBoundary
                    onError={(text) => {
                      failure.current = { id: candidate.id };
                      setReady(false);
                      setRenderError(t.crashed + text);
                    }}
                  >
                    <Candidate
                      candidate={candidate}
                      state={{ playing, thumbnail: false, values }}
                    />
                  </RenderBoundary>
                </div>
                <div className="sp-stage-top sp-ui">
                  {many ? (
                    <span className="sp-position">
                      {pad(selected + 1)}{" "}
                      <span>/ {pad(candidates.length)}</span>
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="sp-stage-actions">
                    {adjustable && (
                      <button
                        ref={tuneButton}
                        className="sp-button"
                        aria-expanded={tuning}
                        aria-controls={panelId}
                        onClick={() => setTuning((v) => !v)}
                      >
                        <Icon name="tune" />
                        <span>{t.tune}</span>
                        {changed.length > 0 && <span className="sp-dot" />}
                      </button>
                    )}
                    <button
                      className="sp-button sp-icon"
                      title={immersive ? t.exit : t.enter}
                      aria-label={immersive ? t.exit : t.enter}
                      aria-pressed={immersive}
                      onClick={() => setImmersive((v) => !v)}
                    >
                      <Icon name={immersive ? "close" : "expand"} />
                    </button>
                  </div>
                </div>
                {!ready && !renderError && (
                  <span className="sp-loading sp-ui" role="status">
                    {t.loading}
                  </span>
                )}
                {renderError && (
                  <div className="sp-error sp-ui" role="alert">
                    <strong>{t.errorTitle}</strong>
                    <p>{renderError}</p>
                    <button
                      className="sp-button"
                      onClick={() => location.reload()}
                    >
                      {t.reload}
                    </button>
                  </div>
                )}
                {!candidate.layout && (
                  <div className="sp-stage-bottom sp-ui">
                    <div className="sp-caption">{caption}</div>
                    {tools}
                  </div>
                )}
                {message.text && (
                  <div className="sp-toast sp-ui" role="status">
                    {message.text}
                  </div>
                )}
              </section>
              {candidate.layout && (
                <div className="sp-label sp-ui">
                  <div className="sp-label-caption">{caption}</div>
                  {tools}
                </div>
              )}
            </div>
            {tuning && adjustable && (
              <aside
                className="sp-panel sp-ui"
                id={panelId}
                aria-label={t.tune}
              >
                <div className="sp-panel-heading">
                  <h2>{t.tune}</h2>
                  <button
                    ref={closeTune}
                    className="sp-button sp-icon"
                    title={t.closeTune}
                    aria-label={t.closeTune}
                    onClick={() => {
                      setTuning(false);
                      tuneButton.current?.focus();
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                {candidate.controls?.map((control) => (
                  <Slider
                    key={control.id}
                    control={control}
                    value={values[control.id]}
                    onChange={(value) => setValue(control.id, value)}
                  />
                ))}
                {candidate.palette?.length ? (
                  <>
                    <div className="sp-palette-label">{t.palette}</div>
                    <div className="sp-palette">
                      {candidate.palette.map((color, index) => (
                        <span
                          key={index}
                          style={{ background: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
                {candidate.controls?.length ? (
                  <button
                    className="sp-button sp-reset"
                    onClick={reset}
                    disabled={!changed.length}
                  >
                    <Icon name="reset" />
                    {t.reset}
                  </button>
                ) : null}
              </aside>
            )}
          </div>
          <div className="sp-transport sp-ui">
            <div className="sp-meta">
              {candidate.subtitle && <span>{candidate.subtitle}</span>}
              {candidate.effect && (
                <span className="sp-native">{candidate.effect}</span>
              )}
            </div>
            <div className="sp-playback">
              {many && (
                <button
                  className="sp-button sp-icon"
                  title={t.prev}
                  aria-label={t.prev}
                  onClick={() => select(selected - 1)}
                >
                  <Icon name="prev" />
                </button>
              )}
              <button
                className="sp-button sp-play"
                title={playing ? t.pause : t.play}
                aria-label={playing ? t.pause : t.play}
                onClick={() => setPlaying((v) => !v)}
              >
                <Icon name={playing ? "pause" : "play"} />
              </button>
              {many && (
                <button
                  className="sp-button sp-icon"
                  title={t.next}
                  aria-label={t.next}
                  onClick={() => select(selected + 1)}
                >
                  <Icon name="next" />
                </button>
              )}
              <span className="sp-status">
                {playing ? t.playing : t.paused}
              </span>
            </div>
            <span className="sp-powered">Paper Shaders · WebGL</span>
          </div>
          {many && (
            <section className="sp-collection" aria-label={t.candidates}>
              <div className="sp-collection-heading sp-ui">
                <h2>{t.candidates}</h2>
                <p>{t.hint}</p>
              </div>
              <div className="sp-filmstrip">
                {candidates.map((item, index) => (
                  <div
                    key={item.id}
                    className={`sp-tile${selected === index ? " is-selected" : ""}`}
                  >
                    <div className="sp-thumb" aria-hidden="true">
                      <div className="sp-thumb-content" ref={inert}>
                        <RenderBoundary>
                          <Candidate
                            candidate={item}
                            state={{
                              playing: false,
                              thumbnail: true,
                              values: valuesOf(item),
                            }}
                          />
                        </RenderBoundary>
                      </div>
                      <span className="sp-tile-number sp-ui">
                        {pad(index + 1)}
                      </span>
                      {selected === index && (
                        <span className="sp-tile-active sp-ui">
                          {t.current}
                        </span>
                      )}
                    </div>
                    <div className="sp-tile-info sp-ui">
                      <span>
                        {item.title}
                        {changedOf(item).length > 0 && (
                          <span className="sp-dot" />
                        )}
                      </span>
                      <span>{item.effect ?? item.subtitle}</span>
                    </div>
                    <button
                      className="sp-button sp-tile-button"
                      aria-label={t.view(item.title)}
                      aria-pressed={selected === index}
                      onClick={() => select(index)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
