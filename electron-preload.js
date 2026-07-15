// 预加载：向渲染进程暴露本地自动保存 + 免费 TTS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reelvasDesktop', {
  isDesktop: true,
  getDefaultAutoSaveDir: () => ipcRenderer.invoke('autosave:getDefaultDir'),
  ensureAutoSaveDir: (dir) => ipcRenderer.invoke('autosave:ensureDir', dir),
  writeAutoSaveFile: (payload) => ipcRenderer.invoke('autosave:write', payload),
  readAutoSaveFile: (payload) => ipcRenderer.invoke('autosave:read', payload || {}),
  chooseAutoSaveDir: () => ipcRenderer.invoke('autosave:chooseDir'),
  openAutoSaveDir: (dir) => ipcRenderer.invoke('autosave:openDir', dir),
  /** 免费 Edge TTS → { ok, base64, bytes } */
  freeTts: (payload) => ipcRenderer.invoke('tts:free', payload || {}),
  /** 图像请求转发（绕过浏览器 WAF）→ { ok, status, base64 } */
  imageProxy: (payload) => ipcRenderer.invoke('image:proxy', payload || {}),
});
