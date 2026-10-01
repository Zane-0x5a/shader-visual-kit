import {useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {ShaderMount, type ShaderMountUniforms} from '@paper-design/shaders';
import {getRemotionEnvironment, useBufferState, useDelayRender} from 'remotion';

type Uniforms = Record<string, ShaderMountUniforms[string] | string>;
type Props = {
  fragmentShader: string;
  uniforms: Uniforms;
  timeMs: number;
  style?: CSSProperties;
  minPixelRatio?: number;
  maxPixelCount?: number;
  mipmaps?: string[];
  webGlContextAttributes?: WebGLContextAttributes;
};

// Paper 0.0.81 consumes texture upload errors internally. Observe those reads
// during its synchronous calls, then restore the exact browser descriptor.
function checkedPaperCall(element: HTMLElement, action: () => void) {
  const prototype = WebGL2RenderingContext.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'getError')!;
  const original = prototype.getError;
  const textureDescriptor = Object.getOwnPropertyDescriptor(prototype, 'createTexture')!;
  const createTexture = prototype.createTexture;
  const errors = new Set<number>();
  Object.defineProperty(prototype, 'getError', {...descriptor, value: function(this: WebGL2RenderingContext) {
    const code = original.call(this);
    if (code !== this.NO_ERROR && this.canvas instanceof HTMLCanvasElement && element.contains(this.canvas)) errors.add(code);
    return code;
  }});
  try {
    Object.defineProperty(prototype, 'createTexture', {...textureDescriptor, value: function(this: WebGL2RenderingContext) {
      const texture = createTexture.call(this);
      if (!texture && this.canvas instanceof HTMLCanvasElement && element.contains(this.canvas)) errors.add(this.OUT_OF_MEMORY);
      return texture;
    }});
    action();
  } finally {
    Object.defineProperty(prototype, 'getError', descriptor);
    Object.defineProperty(prototype, 'createTexture', textureDescriptor);
  }
  if (errors.size) throw new Error(`Paper: WebGL texture or shader operation failed (${[...errors].join(', ')})`);
}

/** Copy into the host project. Uses Paper's native fragment shader and uniforms. */
export function PaperFrame({
  fragmentShader, uniforms, timeMs, style, minPixelRatio = 1,
  maxPixelCount = 3840 * 2160, mipmaps, webGlContextAttributes,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<{mount: ShaderMount; key: string; canvas: HTMLCanvasElement} | null>(null);
  const optionsKey = JSON.stringify({mipmaps: mipmaps ?? [], attributes: {...webGlContextAttributes, preserveDrawingBuffer: true}});
  const images = useRef(new Map<string, HTMLImageElement>());
  const [error, setError] = useState<string | null>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const buffer = useBufferState();

  useLayoutEffect(() => () => {
    instance.current?.mount.dispose();
    instance.current = null;
    images.current.clear();
  }, []);

  useLayoutEffect(() => {
    if (element.current) delete element.current.dataset.paperTimeMs;
    const disposeInstance = () => {
      instance.current?.mount.dispose();
      instance.current = null;
    };
    const controller = new AbortController();
    let disposed = false;
    let completed = false;
    let failed = false;
    const timeout = window.setTimeout(() => {
      controller.abort();
      fail(new Error('Paper: resources or layout did not become ready within 15 seconds'));
    }, 15000);
    const handle = delayRender('Paper: textures, layout and current frame');
    const playback = buffer.delayPlayback();
    const finish = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      playback.unblock();
      continueRender(handle);
    };
    const fail = (cause: unknown) => {
      if (disposed || failed) return;
      failed = true;
      controller.abort();
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      disposeInstance();
      if (element.current) delete element.current.dataset.paperTimeMs;
      setError(failure.message);
      if (getRemotionEnvironment().isRendering) cancelRender(failure);
      finish();
    };
    let lostCanvas: HTMLCanvasElement | undefined;
    const contextLost = () => fail(new Error('Paper: WebGL context lost'));

    const render = async () => {
      if (!Number.isFinite(timeMs)) throw new Error('Paper: timeMs must be finite');
      if (!Number.isFinite(minPixelRatio) || minPixelRatio <= 0 || !Number.isFinite(maxPixelCount) || maxPixelCount < 1) {
        throw new Error('Paper: pixel ratio and pixel count must be positive finite values');
      }
      if (!element.current) throw new Error('Paper: mount element is missing');
      setError(null);
      const loaded: ShaderMountUniforms = {};
      await Promise.all(Object.entries(uniforms).map(async ([key, value]) => {
        if (typeof value !== 'string') {
          if (value instanceof HTMLImageElement) await value.decode();
          loaded[key] = value;
          return;
        }
        if (!value) throw new Error(`Paper: empty image URL for ${key}`);
        let img = images.current.get(value);
        if (!img) {
          const response = await fetch(value, {signal: controller.signal});
          if (!response.ok) throw new Error(`Paper image ${key}: HTTP ${response.status} (${value})`);
          const objectUrl = URL.createObjectURL(await response.blob());
          try {
            img = new Image();
            img.src = objectUrl;
            await img.decode();
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
          if (disposed) return;
          if (images.current.size >= 8) images.current.delete(images.current.keys().next().value!);
          images.current.set(value, img);
        }
        loaded[key] = img;
      }));
      if (disposed || controller.signal.aborted || !element.current) return;
      const rect = element.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error('Paper: canvas needs non-zero dimensions');
      const options = JSON.parse(optionsKey) as {mipmaps: string[]; attributes: WebGLContextAttributes};
      // Paper discovers uniform locations at construction, including image aspect ratios.
      const key = JSON.stringify([fragmentShader, optionsKey, Object.entries(loaded).map(([name, value]) => [name, value instanceof HTMLImageElement]).sort()]);
      if (instance.current?.key !== key) {
        instance.current?.mount.dispose();
        instance.current = null;
        // Paper prepends a canvas before checking WebGL. Remove it if construction fails.
        try {
          const parent = element.current;
          checkedPaperCall(parent, () => {
            const mount = new ShaderMount(parent, fragmentShader, loaded,
              options.attributes, 0, timeMs, minPixelRatio, maxPixelCount, options.mipmaps);
            instance.current = {mount, key, canvas: mount.canvasElement};
          });
        } catch (failure) {
          disposeInstance();
          element.current.querySelectorAll('canvas').forEach(canvas => {
            canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
            canvas.remove();
          });
          throw new Error(`Paper: shader initialization failed: ${failure instanceof Error ? failure.message : String(failure)}`, {cause: failure});
        }
      } else {
        instance.current.mount.setMinPixelRatio(minPixelRatio);
        instance.current.mount.setMaxPixelCount(maxPixelCount);
        checkedPaperCall(element.current, () => instance.current!.mount.setUniforms(loaded));
      }
      const current = instance.current!;
      lostCanvas = current.canvas;
      lostCanvas.addEventListener('webglcontextlost', contextLost);
      // A layout checkpoint, not an arbitrary time delay: allow Paper's ResizeObserver to run.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (disposed || controller.signal.aborted) return;
      const gl = current.canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw new Error('Paper: WebGL2 unavailable');
      current.mount.setFrame(timeMs);
      const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
      if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Paper: shader program did not link');
      }
      gl.finish();
      const code = gl.getError();
      if (code !== gl.NO_ERROR) throw new Error(`Paper: WebGL error ${code}`);
      element.current.dataset.paperTimeMs = String(timeMs);
      finish();
    };
    void render().catch(fail);
    return () => {
      disposed = true;
      controller.abort();
      lostCanvas?.removeEventListener('webglcontextlost', contextLost);
      finish();
    };
  }, [fragmentShader, uniforms, timeMs, minPixelRatio, maxPixelCount, optionsKey, style?.width, style?.height,
    delayRender, continueRender, cancelRender, buffer]);

  return <div ref={element} style={{width: '100%', height: '100%', flexShrink: 0, ...style}}>
    {error ? <div role="alert">{error}</div> : null}
  </div>;
}
