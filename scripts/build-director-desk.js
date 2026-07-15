// 独立构建 vendor 开源 3D 导演台 → public/director-desk（不并入主包逻辑）
// 用法: node scripts/build-director-desk.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vendor = path.join(root, 'vendor', 'storyai-3d-director-desk');
const dist = path.join(vendor, 'dist');
const target = path.join(root, 'public', 'director-desk');

function run(cmd, args, cwd) {
  console.log('[build-director-desk]', cmd, args.join(' '), '@', cwd);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      // Vite base：与主站同域 /director-desk/ 嵌入
      VITE_BASE: '/director-desk/',
    },
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(vendor)) {
  console.error('[build-director-desk] missing vendor:', vendor);
  process.exit(1);
}

// 仅写 base 路径，不改业务源码
const vitePath = path.join(vendor, 'vite.config.ts');
let viteSrc = fs.readFileSync(vitePath, 'utf8');
if (!viteSrc.includes("base: process.env.VITE_BASE")) {
  if (viteSrc.includes('base: "/",')) {
    viteSrc = viteSrc.replace(
      'base: "/",',
      'base: process.env.VITE_BASE || "/",',
    );
  } else if (viteSrc.includes("base: '/',")) {
    viteSrc = viteSrc.replace(
      "base: '/',",
      'base: process.env.VITE_BASE || "/",',
    );
  } else {
    viteSrc = viteSrc.replace(
      'export default defineConfig({',
      'export default defineConfig({\n  base: process.env.VITE_BASE || "/",',
    );
  }
  fs.writeFileSync(vitePath, viteSrc, 'utf8');
  console.log('[build-director-desk] patched vite base for embed path');
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!fs.existsSync(path.join(vendor, 'node_modules'))) {
  run(npm, ['install'], vendor);
}
run(npm, ['run', 'build'], vendor);

if (!fs.existsSync(dist)) {
  console.error('[build-director-desk] dist missing after build');
  process.exit(1);
}

rmrf(target);
copyDir(dist, target);
console.log('[build-director-desk] copied →', target);
