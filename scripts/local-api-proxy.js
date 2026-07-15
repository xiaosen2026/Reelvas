// next dev 侧车：仅提供 /api/image-proxy + /api/media-proxy（默认 3921）
// next.config 在 development 下 rewrite 到本服务
const http = require('http');
const { tryHandleApiProxy, send } = require('./httpProxies');

const PORT = Number(process.env.REELVAS_API_PROXY_PORT || 3921);

const server = http.createServer((req, res) => {
  if (tryHandleApiProxy(req, res)) return;
  send(res, 404, JSON.stringify({ error: 'not found' }), {
    'Content-Type': 'application/json',
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-api-proxy] http://127.0.0.1:${PORT}`);
  console.log(
    '[local-api-proxy] POST /api/image-proxy  POST /api/image-host-upload  GET /api/media-proxy?url=',
  );
});

server.on('error', (err) => {
  console.error('[local-api-proxy] listen fail', err.message);
  process.exit(1);
});
