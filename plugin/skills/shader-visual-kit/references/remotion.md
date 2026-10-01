# Remotion 的时间与就绪

Paper 的 frame 单位是毫秒。由视频帧计算 `initialMs + useCurrentFrame() / fps * 1000 * rate`，同时设置 Paper speed 为 0。Sequence 中 useCurrentFrame 是局部时间；若需要连续全局时间，从外层传入。负 rate 为反向，0 为静止。

Paper React 的异步纹理更新没有通用公开就绪回调。仅观察 canvas 或 mount 不足以证明当前图片已应用。需要可靠逐帧输出时，可将 [PaperFrame.tsx](../assets/PaperFrame.tsx) 复制到宿主，再按宿主版本调整；产品直接导入项目内文件。

这个辅助接收官方 fragmentShader、原生 uniforms 和 timeMs。颜色字符串先用官方 getShaderColorFromString 转换；uniform 中的字符串专用于图片 URL。图片先 fetch/decode，再交给 ShaderMount；HTMLImageElement 也会 decode。URL 缓存按完整地址区分，同 URL 内容变化需更换版本地址或重挂载。跨域资源需要服务器允许 CORS。

网页与 Remotion 导出的静态资源根路径可能不同。导出 Composition 的 `public/` 素材使用宿主的 `staticFile()` 解析；网页 Player 可由页面传入自己的资源 URL。迁移时沿这两个真实入口分别验证，不能把网页的 `/assets/...` 原样当作 Remotion 导出地址。

迁移效果时，同时核对官方组件传给 ShaderMount 的挂载选项。Water、LiquidMetal、FlutedGlass 等效果使用 `mipmaps={['u_image']}`，仅复制 shader 和 uniforms 会改变采样画面。辅助支持原生 `mipmaps`、`webGlContextAttributes`、`minPixelRatio` 和 `maxPixelCount`；为可靠截帧固定 `preserveDrawingBuffer: true`。采样、上下文选项或 uniform 结构改变时重建实例。

它使用 useDelayRender 等待导出，useBufferState 等待 Player 播放，并在尺寸、纹理、当前时间及 GPU 提交完成后放行。资源超过 15 秒失败；可按宿主资源预算调整。导出时失败取消渲染，Player 显示错误。以明确尺寸挂载，尤其注意 Remotion 元数据选择阶段的 flex 布局。uniforms 对象保持稳定以避免无意义更新。

Paper 0.0.81 内部会读取并消耗纹理上传错误。辅助在同步构造和更新调用期间观察当前画布的 WebGL 错误及空纹理分配，在 `finally` 中恢复浏览器方法；不跨异步等待保留拦截。失败后销毁实例，避免重试命中 Paper 的失败 uniform 缓存。升级 Paper 时必须重验上传失败、恢复及原生像素对照，不能仅依赖最后一次 `gl.getError()`。

最小用法（uniforms 从当前效果官方源码/类型确定，不是通用参数对象）：

```tsx
const frame = useCurrentFrame();
const {fps, width, height} = useVideoConfig();
return <PaperFrame fragmentShader={nativeFragmentShader}
  uniforms={nativeUniforms} timeMs={frame / fps * 1000}
  style={{width, height}} />;
```

修改后检查重复/乱序取同帧、慢图快速往返、中途换图、解码及 GPU 上传失败、失败恢复；预览播放与最终导出分别验证。同一浏览器、WebGL 后端、尺寸和像素比下比较像素，跨 GPU 不承诺逐像素一致。完整渲染回归使用 Paper 0.0.81 / Remotion 4.0.526；其他版本按实际宿主验收。这是原生接入辅助，不是完整效果参数封装。
