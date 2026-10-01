# 预览

## 预览页

用户要挑选候选或调整效果时，把候选放进预览页。[`assets/preview/`](../assets/preview/) 是可复制的 React 外壳：大画面、缩略图切换、播放暂停、沉浸观看、保存 PNG、按候选定义的微调，以及把选择复制回 Agent。它只依赖 React，候选用宿主自己的 Paper 渲染；接口与示例见 `ShaderPreview.tsx` 开头。

1. **放置。** React 宿主：把整个目录复制到宿主中不进生产构建的开发期入口，如 Vite 下单独的 `shader-preview.html`，构建一次确认产物里没有它；候选可直接使用宿主的组件、主题和资源。非 React 宿主、只有 Remotion 或尚无项目时，在本次任务的产物目录建 Vite + React 预览项目，`@paper-design/shaders-react` 取宿主 `@paper-design/shaders` 的同一版本。
2. **候选。** 每个读法或变体一个候选：标题短，`description` 用一句话写清它的可见特征，`lang` 取用户的语言。效果依赖真实布局时（如文字压在背景上），在候选里渲染宿主的对应区块并设 `layout: true`：舞台原样呈现它，不加压暗层，标题移到舞台下方；区块高度用视口单位时（如 `min-height: 80vh`）改为填满舞台，其中 `position: fixed` 的层会收在舞台内。缩略图（`thumbnail` 为真）只渲染效果本身。`controls` 只放真正影响选择的一两项，`value` 就是推荐值。
3. **展示。** 用当前宿主的浏览器能力打开页面，服务未运行时按下文启动；打开后逐个核对候选都已出画面。
4. **回传。** 地址 hash 记录当前候选和改动过的值（如 `#rays&speed=1.4`），用户也可点“复制选择”贴回。用户选定后，把该候选落到宿主真实入口并在那里验证。
5. **收尾。** 预览页属于本次任务：交付时说明它的位置；用户不保留时删除，宿主只有路由式入口时交付前删除。

## 启动服务

已有服务直接复用。宿主已有可靠进程会话管理时，也可直接使用它。

配套 CLI 目前只支持 Windows：Node 22.12+，PowerShell 和 Koffi 原生模块可用。其他系统直接采用适合该宿主的进程管理工具，不扩大本 CLI 的承诺。

CLI 与本 Skill 同版本发布，版本以下方命令中的标签为准。首次使用这一版本时，从 GitHub 按标签安装到宿主项目之外、按版本区分的用户级工具目录（如 LOCALAPPDATA 下的 `shader-visual-kit/<版本>`），需要网络和 git；目录里已有入口文件就直接复用。之后用 node 直接运行入口，作为宿主管理的前台或后台任务（如 Claude Code 的后台任务）保持到用户看完、改完这一页，跨回合等待用户选择时也保持运行：宿主停止任务时结束的是 CLI，作业随之清理。CLI 本身经 npx 或 npm 脚本包装后，部分宿主（如 Git Bash 下）的停止到不了它；`--` 之后的宿主命令则可以是 npm 脚本，它的整棵进程树都在作业内。Start-Process、start、`nohup &` 等脱离调用方的启动不受支持，启动者退出时预览随之停止。后台运行时读取任务输出，直到出现 `address-responsive` 或 `error`。接口见 `node <入口> --help`。

```text
npm install --prefix <工具目录> github:Zane-0x5a/shader-visual-kit#v0.1.0
node <工具目录>/node_modules/shader-visual-kit/cli/index.mjs preview --project <宿主目录> --url <http://127.0.0.1:端口/页面> --json -- <命令> <参数...>
```

命令、端口与页面从宿主事实确定，命令在 `--project` 目录中运行。Vite 等允许自动换端口的服务启用严格端口选项。CLI 不装依赖、不改项目配置、不承担编译，也不自动打开浏览器。

输出 `address-responsive` 表示 HTTP 2xx 且监听进程属于此次 Windows Job；仍需检查页面是否是所需画面。工具事件（`starting`、`address-responsive`、`warning`、`error`、`cleanup-error`、`stopped`）在 stdout，宿主日志在 stderr。Ctrl+C、强制终止 CLI 或启动它的上层进程退出，都会清理作业内进程。子命令主动请求脱离作业时，改用适合该宿主的进程管理工具。

端口已占用会拒绝启动，不接管或杀死已有服务。重定向要求明确使用最终 URL。权限不足、缺依赖、启动错误和超时按实际失败处理。日志中的路径与 URL 可供 Agent 使用当前浏览器能力打开，CLI 不依赖浏览器插件内部 API。
