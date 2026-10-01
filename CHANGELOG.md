# Changelog

## 0.1.0

First public release.

- Skill `shader-visual-kit`: description-to-effect candidates, native Paper integration, background stacking, redraw budget, non-square fit, colour mixing, verification and preview guidance; Remotion time mapping and the copyable `PaperFrame.tsx` helper.
- Preview page (`assets/preview/`): a copyable React page that shows the task's candidates, rendered by the host's own Paper, for the user to compare, adjust a little and pick. Immersive view, live thumbnails, play / pause, PNG frames, per-candidate adjustments, and the choice returned through the URL hash or the clipboard.
- Preview CLI for Windows, installed from git tags and run with node. It also stops its job when a launcher in its Windows parent chain exits (for example a cmd or PowerShell wrapper killed without its tree), and reports which launcher it was.
- Claude Code and Codex marketplaces that install only the skill.
