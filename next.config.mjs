/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出，产出 out/ 目录，供 Electron 直接加载
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // 低内存机器上限制并行，避免 SWC/worker 分配失败
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: false,
  },
  productionBrowserSourceMaps: false,
};

// 注意：output:'export' 不支持 rewrites。dev 侧车用 CORS 直连 127.0.0.1:3921
// （见 imageBlobUtils / openaiImages 回退），正式调试用 serve:tts / Electron。

export default nextConfig;
