// 轻量结构化 logger —— 禁止裸 console.log

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, module: string, fn: string, message: string, extra?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    module,
    fn,
    message,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') console.debug(line);
  else console.info(line);
}

export function createLogger(module: string) {
  return {
    debug: (fn: string, message: string, extra?: Record<string, unknown>) => emit('debug', module, fn, message, extra),
    info: (fn: string, message: string, extra?: Record<string, unknown>) => emit('info', module, fn, message, extra),
    warn: (fn: string, message: string, extra?: Record<string, unknown>) => emit('warn', module, fn, message, extra),
    error: (fn: string, message: string, extra?: Record<string, unknown>) => emit('error', module, fn, message, extra),
  };
}
