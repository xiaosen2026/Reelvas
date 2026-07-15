# Reelvas 嵌入说明（不改业务逻辑）

本目录为上游开源仓库 [storyai-3d-director-desk](https://github.com/jiguang132/storyai-3d-director-desk) 的 vendored 副本。

## 与主工程关系

- **独立**：自有 `package.json` / Vite / React 18 / R3F，不并入主应用 React 19 依赖树。
- **构建产物**：`npm run build:director-desk` → `public/director-desk/`，再由 Next `output: 'export'` 进 `out/director-desk/`。
- **宿主**：`components/editor/DirectorDeskEmbed.tsx` 用同域 iframe + postMessage（`storyai:director-desk-*`）。
- **禁止**：把本仓库源码 import 进 `lib/` 或旧 gizmo 实现；不要与已删除的 `lib/director` 混合。

## Windows 备注

上游 `package.json` 曾硬编码 `@rollup/rollup-darwin-arm64`，在本副本中已移除以便 Windows 安装。

## 仅导航/文案

UI 已为中文。若只需改顶栏文案，改 `src/App.tsx` 字符串即可，勿重写交互与骨骼逻辑。
