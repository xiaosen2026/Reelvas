// npm run dev：先起本地 API 代理，再 next dev（Windows 友好）
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const kids = [];

function run(cmd, args, name, { shell = false } = {}) {
  // Windows + shell:true 时含空格路径（如 Program Files）会被拆开，node 脚本用 shell:false
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell,
    env: { ...process.env },
    windowsHide: true,
  });
  child.on('exit', (code, signal) => {
    console.log(`[dev-with-api] ${name} exit`, code, signal || '');
    // 任一退出则收掉另一个
    for (const c of kids) {
      if (!c.killed) c.kill('SIGTERM');
    }
    process.exit(code || 0);
  });
  kids.push(child);
  return child;
}

run(process.execPath, [path.join(__dirname, 'local-api-proxy.js')], 'api-proxy', {
  shell: false,
});
// 稍等端口就绪
setTimeout(() => {
  // npx 在 Windows 上通常需要 shell 解析 .cmd
  run('npx', ['next', 'dev'], 'next-dev', { shell: process.platform === 'win32' });
}, 400);

process.on('SIGINT', () => {
  for (const c of kids) c.kill('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  for (const c of kids) c.kill('SIGTERM');
  process.exit(0);
});
