# shader-visual-kit

<p align="center"><img src="docs/assets/hero.webp" alt="Paper Shaders 的 MeshGradient 缓缓卷成漩涡" width="100%"></p>

让 Agent 在真实项目里用好 [Paper Shaders](https://shaders.paper.design) 的 Skill：网页、React 或原生 JS 应用、Remotion 视频都适用。遇到需要你拿主意的视觉选择时，Agent 把候选摆进一个预览页，供你对比和挑选；另附一个 Windows 小工具负责启动背后的服务，并保证结束时清理干净。

Paper 依赖、参数、预设和素材始终归你的项目所有。本 Skill 是开发期知识与可复制的辅助代码，不是运行时封装；不需要 Paper Desktop。

<sub>非官方项目，与 Paper 无隶属关系。 · [English →](README.md)</sub>

<p align="center"><img src="docs/assets/effects.webp" alt="五个原生 Paper 效果：三个 MeshGradient、一个 SmokeRing、一个 NeuroNoise" width="100%"></p>

<p align="center"><sub>原生 Paper 组件加精选参数——MeshGradient、SmokeRing、NeuroNoise——即<a href="#预览页">预览页</a>的演示候选。</sub></p>

## 能做什么

- **从描述到效果。** 同一个词常有几种看上去截然不同的读法——“光影”可以是从一处射入的光束（GodRays），也可以是铺满画面、缓慢流动的多色形体（Warp、MeshGradient）。Agent 先列出各读法，每种读法做一个候选放进预览页，你选定后再在真实入口里展开。把效果延伸到边框、按钮也算新的视觉选择，同样先出候选。
- **预览页。** 一个可复制的 React 页面（[`assets/preview/`](plugin/skills/shader-visual-kit/assets/preview/)），由 Agent 填入本次任务的候选，用你项目自己的 Paper 渲染：大画面、实时缩略图、播放暂停、沉浸观看、保存 PNG，以及每个候选一两项微调。你的选择和微调值通过地址栏 hash 或“复制选择”按钮回到 Agent。
- **原生接入。** React 用 `@paper-design/shaders-react`，其他浏览器宿主用 `@paper-design/shaders` 的 `ShaderMount`，在客户端挂载、卸载时销毁。效果与参数以 Paper 官方文档和项目已安装的类型为准，工具不维护白名单。
- **常见坑。** 整页背景的层级、`requestAnimationFrame` 按显示器刷新率持续重绘及其预算、非方形元素上默认 `fit`/`scale` 把图形缩成方块、互补色平均成灰褐、嵌入式 WebView 隐藏后收不到隐藏通知。
- **Remotion。** 把视频帧换算为 Paper 的毫秒时间，并提供可复制到项目里的 [`PaperFrame.tsx`](plugin/skills/shader-visual-kit/assets/PaperFrame.tsx)：纹理解码、布局稳定、GPU 完成之后才放行当前帧；出错时取消渲染，不导出错误画面。
- **预览 CLI（Windows）。** 在 Windows 作业对象里运行项目自己的启动命令；只有 URL 有响应、且监听进程属于这个作业时才报告 `address-responsive`。端口被占用时拒绝启动，不接管已有服务；按 Ctrl+C、CLI 被强制结束、或其 Windows 父进程链上的启动者退出时，整棵进程树都会被清理。

## 安装

### Claude Code

```text
/plugin marketplace add Zane-0x5a/shader-visual-kit
/plugin install shader-visual-kit@shader-visual-kit
```

### Codex

```text
codex plugin marketplace add Zane-0x5a/shader-visual-kit
codex plugin add shader-visual-kit@shader-visual-kit
```

### 其他 Agent

```text
npx skills add Zane-0x5a/shader-visual-kit
```

也可以直接把 [`plugin/skills/shader-visual-kit/`](plugin/skills/shader-visual-kit/) 复制到 Agent 的 skills 目录。

安装后开启新会话。插件里只有 Skill 本身；第一次需要启动新的预览服务时，Agent 会安装与 Skill 同版本的 CLI。

## 使用

直接用自己的话说，例如：

- “给登录页加一个缓慢流动的 Paper 背景。”
- “浅色主题下 MeshGradient 发灰发脏，帮我修一下。”
- “把这个 Paper 场景导出成 10 秒的 Remotion 视频。”
- “首页背景想要安静、有光感的，给我几个方向看看。”
- “把开发服务跑起来，给我看看效果。”

## 预览页

<p align="center"><img src="docs/assets/preview.zh-CN.webp" alt="预览页：上方是大幅的余晖 MeshGradient，带标题、复制选择和保存当前帧，下方是五个候选缩略图" width="100%"></p>

Agent 把 [`assets/preview/`](plugin/skills/shader-visual-kit/assets/preview/) 复制到你项目里的开发期入口；非 React 宿主或 Remotion 项目则放进本次任务的独立预览项目，Paper 版本与你的项目一致。每个候选是一个小对象，`render` 返回你项目自己的 Paper 组件：

```tsx
<ShaderPreview lang="zh" title="首页背景：光影的两种读法" candidates={[
  { id: "rays", title: "光束", effect: "GodRays", description: "暗底上斜射进来的一束暖光",
    controls: [{ id: "speed", label: "流动速度", min: 0, max: 2, step: 0.05, value: 1, unit: "×" }],
    render: ({ playing, values }) => <GodRays {...rays} speed={playing ? 0.6 * values.speed : 0} /> },
  { id: "flow", title: "流光", effect: "MeshGradient", description: "铺满画面、缓慢流动的多色形体",
    render: ({ playing }) => <MeshGradient {...flow} speed={playing ? 0.3 : 0} /> },
]} />
```

页面只依赖 React，它的样式与你的样式互不影响；候选可以直接渲染你真实布局中的区块（设 `layout: true` 时原样呈现，标题移到舞台下方），其中的 fixed 背景会收在舞台内。带演示候选运行：

```text
npm ci
npm run demo
```

然后打开 `http://127.0.0.1:5188/?lang=zh`。

## 预览 CLI

Agent 把与 Skill 同版本的 CLI 安装到用户级工具目录，再用 node 直接运行：

```text
npm install --prefix <工具目录> github:Zane-0x5a/shader-visual-kit#v0.1.0
node <工具目录>/node_modules/shader-visual-kit/cli/index.mjs preview --project <宿主目录> --url http://127.0.0.1:5173/ --json -- npm run dev -- --port 5173 --strictPort
```

工具事件（`starting`、`address-responsive`、`warning`、`error`、`cleanup-error`、`stopped`）以 JSON 行写到 stdout，宿主日志写到 stderr。`address-responsive` 只证明本作业的监听进程返回了 HTTP 2xx，不代表画面正确。

之所以用 node 直接运行：有些 Agent 宿主停止后台任务时，只结束它亲自启动的那个进程（例如 Windows 上 Git Bash 里的 Claude Code）。中间隔着 npx 或 npm 的 shell 包装时，Git Bash 模拟的 fork 会让 Windows 父进程链断开，停止到不了 CLI；直接运行时能到达，作业随之清理。请让 CLI 留在调用方持有的任务里：以 `Start-Process`、`start`、`nohup &` 等方式脱离启动时，启动者一退出预览就会停止，CLI 会输出原因。

## 环境要求

- **Skill：** 支持 Agent Skills 的任意宿主。项目自行安装 `@paper-design/shaders` / `@paper-design/shaders-react`，做视频时再装 Remotion。预览页需要 React，可以在你的项目里，也可以在任务的独立预览项目里。
- **CLI：** Windows、Node.js 22.12+、PowerShell；从 GitHub 安装需要 git。其他系统上，Skill 会让 Agent 改用宿主自己的进程管理。
- **许可证：** Paper Shaders 为 Apache-2.0，本仓库不打包其代码。Remotion 有自己的[许可证](https://remotion.dev/license)，部分公司需要购买公司授权。预览页附带的 Instrument Serif 与 DM Sans 字体采用 SIL Open Font License 1.1，许可证文本与字体放在一起。

## 已验证的范围

Paper Shaders 0.0.81（撰写时的最新版本）、Remotion 4.0.526、Chromium headless shell + ANGLE、Windows 11。

| 命令 | 覆盖 |
| --- | --- |
| `npm test` | 12 项真实 Windows 进程上的 CLI 集成测试：含空格和中文的路径，`& \| < > ^ % !` 等参数原样传递，端口占用、重定向、超时、强制终止、中间启动器被结束、启动器先退出而服务仍在、启动竞态中外来监听的保护；以及版本、安装内容、打包文件的发布一致性检查 |
| `npm run test:render` | 经真实 Remotion 渲染器验证 `PaperFrame`：GPU 上传失败取消输出，原生 mipmap 采样逐像素一致，重复、乱序、并发取帧一致，慢纹理，404 / CORS / 无效 shader / 零尺寸均拒绝，导出 H.264 |
| `npm run test:player` | Remotion Player：超大纹理、空纹理分配、慢速失败的快速切换、加载中卸载、上下文丢失、超时、WebGL 不可用时错误可见，并能恢复 |
| `npm run test:preview` | 在真实浏览器里检查预览页：缩略图、方向键与 hash 链接切换（越界值被夹回范围），微调按候选保存并以文字复制回传，播放与暂停作用于 Paper 帧，未开 `preserveDrawingBuffer` 也能保存 PNG（多层候选按舞台尺寸合成），沉浸观看，WebGL 上下文丢失，减少动态，手机布局，宿主样式与页面样式双向隔离，宿主布局不被压暗层和标题遮盖，fixed 背景收在舞台内，候选抛错时立即报出 |
| `npm run test:hosts` | 在临时目录建两个独立宿主（Paper 0.0.81 独立项目、0.0.80 npm workspace），各自按 lockfile 安装，经 CLI 启动，检查 SSR、hydration 与恢复，并导出 PNG 和 H.264；另建一个 Paper 固定为 0.0.80 的独立预览项目，经 CLI 启停，确认开发期入口不进生产构建 |

另外在隔离的 Claude Code 与 Codex 配置中验证了从 GitHub 安装插件（插件缓存里只有 Skill，Codex 能列出它），以及 `npx skills` 的发现和按标签安装 CLI。在 Git Bash 与 PowerShell 中把 CLI 作为真实后台任务停止，没有残留进程；一个从未见过本 Skill 的 Agent 按 `preview.md` 完整走通了流程：安装 CLI、启动宿主的 npm dev 脚本、检查页面，并干净地停止。

不承诺：跨 GPU 像素一致、覆盖全部 Paper 效果、已测之外的框架（如 Next.js RSC）。其他版本请在自己的项目中验证。

## 仓库结构

```text
plugin/                         Agent 宿主实际安装的内容
  .claude-plugin/plugin.json      Claude Code 清单
  .codex-plugin/plugin.json       Codex 清单
  plugin.json                     通用（portable）插件清单
  skills/shader-visual-kit/       SKILL.md、references/、assets/（预览页、PaperFrame.tsx）
cli/                            预览 CLI，按 git 标签安装
demo/preview/                   带演示候选的预览页（npm run demo）
docs/assets/                    README 与社交预览配图（npm run demo:capture）
tests/                          CLI、发布一致性、预览页、Remotion 渲染 / Player 与宿主测试
.claude-plugin/marketplace.json Claude Code marketplace
.agents/plugins/marketplace.json Codex marketplace
```

## 开发

```text
npm ci
npm test
npm run typecheck
npm run test:render
npm run test:player
npm run test:preview
npm run test:hosts
```

渲染、Player 与预览页测试使用 Remotion 或 Playwright 的浏览器；设置 `REMOTION_BROWSER_EXECUTABLE` 可改用本机 Chromium。`test:hosts` 需要访问 npm 网络。`npm run demo:capture` 会在固定的 Paper 帧上从预览页的演示候选重新渲染 README 配图，需要 PATH 中有 ffmpeg。

发版时同步修改 `package.json`、三个插件清单、Claude marketplace 条目中的版本，以及 `references/preview.md` 和两份 README 里固定的 CLI 标签（不一致时 `npm test` 会失败），再推送 `vX.Y.Z` 标签。

## 许可证

[MIT](LICENSE)
