'use client';

// 生成类节点：监听 Agent submit_nodes，触发本地 onSubmit

import { useEffect } from 'react';
import { subscribeAgentSubmit } from './agentNodeBus';
import { createLogger } from './logger';

const log = createLogger('useAgentSubmitListener');

export function useAgentSubmitListener(
  nodeId: string,
  onSubmit: () => void | Promise<void>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !nodeId) return;
    return subscribeAgentSubmit(nodeId, (detail) => {
      log.info('agentSubmit', 'fire', { nodeId, reason: detail.reason });
      void onSubmit();
    });
  }, [nodeId, onSubmit, enabled]);
}
