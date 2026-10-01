# shader-visual-kit

<p align="center"><img src="docs/assets/hero.webp" alt="A Paper Shaders MeshGradient slowly folding into a swirl" width="100%"></p>

An agent skill for putting [Paper Shaders](https://shaders.paper.design) to work in real projects — web pages, React or vanilla apps, and Remotion videos — plus a small Windows CLI that starts your project's preview server and reliably cleans it up.

Your project keeps owning Paper, its parameters, presets and assets. The skill is development-time knowledge and copyable helper code, not a runtime layer; Paper Desktop is not required.

<sub>Unofficial; not affiliated with Paper. · [中文说明 →](README.zh-CN.md)</sub>

<p align="center"><img src="docs/assets/effects.webp" alt="Five native Paper effects: three MeshGradients, a SmokeRing and a NeuroNoise" width="100%"></p>

<p align="center"><sub>Native Paper components with curated parameters — MeshGradient, SmokeRing, NeuroNoise — from the bundled <a href="#demo-gallery">demo gallery</a>.</sub></p>

## What it does

- **From description to effect.** A visual word often has several readings that look nothing alike — "light and shadow" can be a beam from one point (GodRays) or slow, full-frame colour shapes (Warp, MeshGradient). The agent lists the readings, renders one candidate per reading in your real entry point, and builds out only the one you pick. Extending an effect to borders or buttons counts as a new choice and gets a candidate too.
- **Native integration.** `@paper-design/shaders-react` in React, `ShaderMount` from `@paper-design/shaders` in other browser hosts, mounted on the client and disposed on unmount. Effects and parameters come from Paper's own docs and your installed types, not from a whitelist kept by this tool.
- **Known pitfalls.** Full-page background stacking order, continuous `requestAnimationFrame` redraws at the display's refresh rate and how to budget them, default `fit`/`scale` shrinking effects on non-square elements, complementary hues averaging into mud, and embedded WebViews that never report being hidden.
- **Remotion.** Maps video frames to Paper's millisecond time and ships [`PaperFrame.tsx`](plugin/skills/shader-visual-kit/assets/PaperFrame.tsx), a helper you copy into your project. It holds each frame until textures are decoded, layout has settled and the GPU has finished, and fails the render rather than exporting a wrong frame.
- **Preview CLI (Windows).** Runs your project's own dev command inside a Windows Job Object and reports `address-responsive` only when the URL answers *and* the listener belongs to that job. It refuses occupied ports instead of adopting them, and the whole process tree goes away when you press Ctrl+C, when the CLI is killed, or when a launcher in its Windows parent chain exits.

## Install

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

### Other agents

```text
npx skills add Zane-0x5a/shader-visual-kit
```

Or copy [`plugin/skills/shader-visual-kit/`](plugin/skills/shader-visual-kit/) into your agent's skills directory.

Start a new session after installing. The installed plugin contains only the skill; the agent installs the matching CLI the first time a preview needs a new server.

## Usage

Ask in your own words, for example:

- “Add a slow, flowing Paper background behind the login page.”
- “The MeshGradient looks muddy on the light theme — fix it.”
- “Render this Paper scene as a 10-second Remotion video.”
- “Start the dev server and show me the effect.”

The skill's instructions are written in Chinese; agents follow them whatever language you use.

### Preview CLI

The agent installs the CLI version that matches the skill into a per-user tool directory, then runs it with node:

```text
npm install --prefix <tool-dir> github:Zane-0x5a/shader-visual-kit#v0.1.0
node <tool-dir>/node_modules/shader-visual-kit/cli/index.mjs preview --project <host-dir> --url http://127.0.0.1:5173/ --json -- npm run dev -- --port 5173 --strictPort
```

Tool events (`starting`, `address-responsive`, `warning`, `error`, `cleanup-error`, `stopped`) are JSON lines on stdout; host logs go to stderr. `address-responsive` proves HTTP 2xx from a listener this job owns — not that the page looks right.

Running the entry with node directly matters: some agent hosts stop a background task by ending the process they started (for example, Claude Code on Windows under Git Bash). Behind npx or an npm shell wrapper, that stop never reaches the CLI, because Git Bash's emulated fork breaks the Windows parent chain; with node, it does, and the job is cleaned up. Keep the CLI in a task its caller holds: a detached launch (`Start-Process`, `start`, `nohup &`) stops the preview when its launcher exits, and the CLI says so.

## Demo gallery

The repository includes a small gallery of five curated Paper effects with play / pause, a full-screen view, light tuning and PNG frame capture. It is a showcase of what native Paper components can look like, not something your project imports.

```text
npm ci
npm run demo
```

Then open `http://127.0.0.1:5188/`. The interface is in Chinese.

<p align="center"><img src="docs/assets/gallery.webp" alt="The demo gallery: a large Afterglow MeshGradient stage above five effect thumbnails" width="100%"></p>

## Requirements

- **Skill:** any agent host that supports Agent Skills. Your project installs `@paper-design/shaders` / `@paper-design/shaders-react`, and Remotion if you make video.
- **CLI:** Windows, Node.js 22.12+, PowerShell, and git for the GitHub install. On other systems the skill tells the agent to use the host's own process management.
- **Licenses:** Paper Shaders is Apache-2.0 and is not bundled here. Remotion has its own [license](https://remotion.dev/license); some companies need a company license.

## What has been verified

Paper Shaders 0.0.81 (the latest release at the time of writing), Remotion 4.0.526, Chromium headless shell with ANGLE, Windows 11.

| Command | Covers |
| --- | --- |
| `npm test` | 12 CLI integration tests on real Windows processes — spaced and Chinese paths, argument fidelity including `& \| < > ^ % !`, occupied ports, redirects, timeouts, forced termination, an intermediate launcher being terminated, a launcher that exits while its server lives on, a foreign listener winning the startup race — plus release-consistency checks for versions, install payload and package contents |
| `npm run test:render` | `PaperFrame` through the real Remotion renderer: GPU upload failure cancels output, native mipmap sampling matches pixel for pixel, repeated / out-of-order / concurrent frames are identical, slow textures, 404 / CORS / invalid shader / zero size rejected, H.264 export |
| `npm run test:player` | Remotion Player: visible failure and recovery for oversized textures, null texture allocation, rapid slow-failing switches, unmount while loading, context loss, timeouts and missing WebGL |
| `npm run test:hosts` | Two independent host projects in a temp directory (Paper 0.0.81 standalone, 0.0.80 in an npm workspace), each installed from its own lockfile, run through the CLI, checked for SSR, hydration and recovery, and exported to PNG and H.264 |

Installing the plugin from a checkout was also checked in isolated Claude Code and Codex configurations (only the skill lands in the plugin cache, and Codex lists it), and the CLI was stopped as a real background task from both Git Bash and PowerShell without leaving processes behind.

Not promised: identical pixels across GPUs, every Paper effect, or frameworks beyond those tested (for example Next.js RSC). Check other versions in your own project.

## Repository layout

```text
plugin/                         What agent hosts install
  .claude-plugin/plugin.json      Claude Code manifest
  .codex-plugin/plugin.json       Codex manifest
  plugin.json                     Portable plugin manifest
  skills/shader-visual-kit/       SKILL.md, references/, assets/PaperFrame.tsx
cli/                            Preview CLI, installed from git tags
demo/gallery/                   Demo gallery (npm run demo)
docs/assets/                    README media, regenerated by npm run demo:capture
tests/                          CLI, release, Remotion render / Player and host tests
.claude-plugin/marketplace.json Claude Code marketplace
.agents/plugins/marketplace.json Codex marketplace
```

## Development

```text
npm ci
npm test
npm run typecheck
npm run test:render
npm run test:player
npm run test:hosts
```

The render and Player tests use Remotion's browser or Playwright's; set `REMOTION_BROWSER_EXECUTABLE` to use a local Chromium. `test:hosts` needs network access to npm. `npm run demo:capture` re-renders the README media from the demo gallery at fixed Paper frames and needs ffmpeg on PATH.

To release, bump the version in `package.json`, the three plugin manifests and the Claude marketplace entry, and the pinned CLI tag in `references/preview.md` and both READMEs (`npm test` fails if they disagree), then push a `vX.Y.Z` tag.

## License

[MIT](LICENSE)
