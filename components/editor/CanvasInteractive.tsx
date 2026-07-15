'use client';

import { useState } from 'react';
import { Canvas } from './Canvas';
import { CanvasFlowCore, type WorkflowHandle } from './CanvasFlowCore';
import { CanvasToolbar } from './CanvasToolbar';
import { HelpPopover } from './HelpPopover';
import { TemplatePanel } from './TemplatePanel';
import { PromptLibrary } from './PromptLibrary';

interface Props {
  entered: boolean;
  onEnter: () => void;
  workflowRef: React.MutableRefObject<WorkflowHandle | null>;
  onWorkflowChange?: () => void;
}

// 画布交互层：管理工具栏/帮助/模板/提示词库面板的显示状态
// 画布渲染由 CanvasFlowCore 负责（自研 flow 引擎，无第三方依赖）
export function CanvasInteractive({ entered, onEnter, workflowRef, onWorkflowChange }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  if (!entered) {
    return <Canvas entered={false} onEnter={onEnter} />;
  }

  return (
    <Canvas entered onEnter={() => {}}>
      <CanvasFlowCore workflowRef={workflowRef} onWorkflowChange={onWorkflowChange} />
      <CanvasToolbar
        onHelp={() => setShowHelp(true)}
        onTemplate={() => setShowTemplate(true)}
        onPromptLibrary={() => setShowPrompt(true)}
      />
      {showHelp && <HelpPopover onClose={() => setShowHelp(false)} />}
      {showTemplate && <TemplatePanel onClose={() => setShowTemplate(false)} />}
      {showPrompt && <PromptLibrary onClose={() => setShowPrompt(false)} />}
    </Canvas>
  );
}
