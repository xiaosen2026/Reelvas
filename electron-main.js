// Reelvas —— Electron 主进程
// 静态导出 out/ + 文档目录自动保存 IPC
const { app, BrowserWindow, protocol, net, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const OUT_DIR = path.join(__dirname, 'out');
const PRELOAD = path.join(__dirname, 'electron-preload.js');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function handleAppRequest(request) {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  } else if (!path.extname(pathname)) {
    pathname += '/index.html';
  }
  const filePath = path.join(OUT_DIR, pathname);
  return net.fetch(pathToFileURL(filePath).toString());
}

function defaultAutoSaveDir() {
  return path.join(app.getPath('documents'), 'Reelvas', 'Autosave');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveAutoSaveDir(dir) {
  if (dir && typeof dir === 'string' && dir.trim() && !dir.includes('文档\\') && !dir.includes('文档/')) {
    return path.normalize(dir.trim());
  }
  return defaultAutoSaveDir();
}

function registerFreeTtsIpc() {
  ipcMain.handle('tts:free', async (_e, payload = {}) => {
    try {
      const { synthesizeEdgeMp3Node } = require('./scripts/edgeTtsNode');
      const text = String(payload.text || payload.input || '').trim();
      const voice = String(payload.voice || 'zh-CN-XiaoxiaoNeural');
      if (!text) return { ok: false, error: '请输入要朗读的文本' };
      const buf = await synthesizeEdgeMp3Node({ text, voice });
      return {
        ok: true,
        base64: buf.toString('base64'),
        bytes: buf.length,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

function registerImageProxyIpc() {
  // 主进程转发图像请求到上游网关，绕过渲染进程 WAF（无 Origin / 伪装 UA）
  ipcMain.handle('image:proxy', async (_e, payload = {}) => {
    try {
      const upstreamUrl = String(payload.url || '').trim();
      if (!upstreamUrl) return { ok: false, error: 'missing url' };
      const headers = {
        ...(payload.headers || {}),
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      };
      const body = payload.bodyBase64 ? Buffer.from(payload.bodyBase64, 'base64') : undefined;
      const resp = await net.fetch(upstreamUrl, {
        method: payload.method || 'POST',
        headers,
        body,
      });
      const buf = Buffer.from(await resp.arrayBuffer());
      return {
        ok: resp.ok,
        status: resp.status,
        base64: buf.toString('base64'),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

function registerAutosaveIpc() {
  ipcMain.handle('autosave:getDefaultDir', () => defaultAutoSaveDir());

  ipcMain.handle('autosave:ensureDir', (_e, dir) => {
    try {
      const target = resolveAutoSaveDir(dir);
      ensureDir(target);
      return { ok: true, dir: target };
    } catch (err) {
      return { ok: false, dir: '', error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('autosave:write', (_e, payload = {}) => {
    try {
      const targetDir = resolveAutoSaveDir(payload.dir);
      ensureDir(targetDir);
      const base = String(payload.fileName || 'workflow.json').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
      const fileName = base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
      const full = path.join(targetDir, fileName);
      fs.writeFileSync(full, String(payload.content ?? ''), 'utf8');
      return { ok: true, path: full, dir: targetDir };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('autosave:read', (_e, payload = {}) => {
    try {
      let full = '';
      const abs = payload.absolutePath && String(payload.absolutePath).trim();
      if (abs && (path.isAbsolute(abs) || /^[a-zA-Z]:[\\/]/.test(abs))) {
        full = path.normalize(abs);
      } else {
        const targetDir = resolveAutoSaveDir(payload.dir);
        const base = String(payload.fileName || 'workflow.json').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
        const fileName = base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
        full = path.join(targetDir, fileName);
      }
      if (!fs.existsSync(full)) {
        return { ok: false, error: 'not found', path: full };
      }
      const content = fs.readFileSync(full, 'utf8');
      return { ok: true, content, path: full };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('autosave:chooseDir', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await dialog.showOpenDialog(win || undefined, {
        title: '选择自动保存目录',
        defaultPath: defaultAutoSaveDir(),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || !res.filePaths?.[0]) {
        return { ok: false, cancelled: true };
      }
      const dir = res.filePaths[0];
      ensureDir(dir);
      return { ok: true, dir };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('autosave:openDir', async (_e, dir) => {
    try {
      const target = resolveAutoSaveDir(dir);
      ensureDir(target);
      await shell.openPath(target);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Reelvas',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD,
    },
  });

  const indexHtml = path.join(OUT_DIR, 'editor', '_', 'index.html');
  if (fs.existsSync(indexHtml)) {
    win.loadURL('app://local/editor/_/');
  } else {
    win.loadURL('http://localhost:3000/editor/_/');
  }
  return win;
}

function buildMenu() {
  const template = [
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // 首次启动即创建文档/Reelvas/Autosave
  try {
    ensureDir(defaultAutoSaveDir());
  } catch (_) {
    /* ignore */
  }
  registerAutosaveIpc();
  registerFreeTtsIpc();
  registerImageProxyIpc();
  protocol.handle('app', handleAppRequest);
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
