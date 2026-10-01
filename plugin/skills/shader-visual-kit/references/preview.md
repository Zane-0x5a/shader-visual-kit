# 按需启动预览

已有服务直接复用。宿主已有可靠进程会话管理时，也可直接使用它。

配套 CLI 目前只支持 Windows：Node 22.12+，PowerShell 和 Koffi 原生模块可用。其他系统直接采用适合该宿主的进程管理工具，不扩大本 CLI 的承诺。

CLI 与本 Skill 同版本发布。首次使用这一版本时，从 GitHub 按标签安装到宿主项目之外、按版本区分的用户级工具目录（如 LOCALAPPDATA 下的 `shader-visual-kit/<版本>`），需要网络和 git；目录里已有入口文件就直接复用。之后用 node 直接运行入口，作为宿主管理的前台或后台任务保持到使用结束：宿主停止任务时结束的是 CLI，作业随之清理。经 npx 或 npm 脚本包装后，部分宿主（如 Git Bash 下）的停止到不了 CLI；Start-Process、start、`nohup &` 等脱离调用方的启动，会在启动者退出时让预览一起停止。接口见 `node <入口> --help`。

```text
npm install --prefix <工具目录> github:Zane-0x5a/shader-visual-kit#v0.1.0
node <工具目录>/node_modules/shader-visual-kit/cli/index.mjs preview --project <宿主目录> --url <http://127.0.0.1:端口/页面> --json -- <命令> <参数...>
```

命令、cwd、端口与页面从宿主事实确定。Vite 等允许自动换端口的服务启用严格端口选项。CLI 不装依赖、不改项目配置、不承担编译，也不自动打开浏览器。

输出 `address-responsive` 表示 HTTP 2xx 且监听进程属于此次 Windows Job；仍需检查页面是否是所需画面。工具事件在 stdout，宿主日志在 stderr。Ctrl+C、强制终止 CLI 或启动它的上层进程退出，都会清理作业内进程。子命令主动请求脱离作业时，改用适合该宿主的进程管理工具。

端口已占用会拒绝启动，不接管或杀死已有服务。重定向要求明确使用最终 URL。权限不足、缺依赖、启动错误和超时按实际失败处理。日志中的路径与 URL 可供 Agent 使用当前浏览器能力打开，CLI 不依赖浏览器插件内部 API。
