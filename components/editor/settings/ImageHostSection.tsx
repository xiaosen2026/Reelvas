'use client';

import { useEffect, useState } from 'react';
import {
  loadImageHostSettings,
  saveImageHostSettings,
  subscribeImageHostSettings,
  type ImageHostSettings,
} from '../../../lib/imageHostSettings';
import { Switch } from './Switch';
import { createLogger } from '../../../lib/logger';

const log = createLogger('ImageHostSection');

/** 图像模型设置：图生图走公网图床再提交 URL */
export function ImageHostSection() {
  const [cfg, setCfg] = useState<ImageHostSettings>(() => loadImageHostSettings());

  useEffect(() => {
    setCfg(loadImageHostSettings());
    return subscribeImageHostSettings(setCfg);
  }, []);

  const setEnabled = (enabled: boolean) => {
    const next = { ...cfg, enabled };
    setCfg(next);
    saveImageHostSettings(next);
    log.info('setEnabled', enabled ? 'on' : 'off');
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-white overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-7 py-5">
        <div className="flex items-start gap-4 min-w-0">
          <span className="size-10 shrink-0 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-sm font-semibold">
            URL
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">图生图 · 公网图床</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              开启后：参考图会先上传到网络图床（当前 <span className="font-mono">img.remit.ee</span>
              ），再把<strong className="font-medium text-foreground"> 公网 URL </strong>
              提交给图像模型。比浏览器直传二进制更稳，也<strong className="font-medium text-foreground">
                {' '}
                不必强行压缩图片
              </strong>
              。
            </p>
            <p className="text-[11px] text-amber-700/90 mt-2 leading-relaxed">
              注意：图床为公开链接，任何持有 URL 的人可访问；免费服务不保证长期保存。关闭后回退为本地
              Blob / 跨域代理路径。
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
              流程：参考图 → 图床上传 → 模型 API（URL）
            </p>
          </div>
        </div>
        <Switch
          checked={cfg.enabled}
          onChange={() => setEnabled(!cfg.enabled)}
          label="图生图使用公网图床"
        />
      </div>
    </div>
  );
}
