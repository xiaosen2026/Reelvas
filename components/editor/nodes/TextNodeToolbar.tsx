'use client';

// 文本节点顶部格式工具栏：B I U | H1-3 | 排版 复制 全屏（无转表格）

import { NodeTopBar } from './NodeTopBar';
import { TextFormatBar } from './TextFormatBar';

type Props = {
  nodeId: string;
  selected?: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  text: string;
  hasResult: boolean;
  editing: boolean;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onStartEdit: () => void;
  onTextChange: (value: string) => void;
  onFullscreen: () => void;
};

export function TextNodeToolbar({
  nodeId,
  selected,
  cardRef,
  text,
  hasResult,
  editing,
  editorRef,
  onStartEdit,
  onTextChange,
  onFullscreen,
}: Props) {
  return (
    <NodeTopBar cardRef={cardRef} selected={selected} barW={360} gap={12}>
      <TextFormatBar
        nodeId={nodeId}
        text={text}
        hasResult={hasResult}
        editing={editing}
        editorRef={editorRef}
        onStartEdit={onStartEdit}
        onTextChange={onTextChange}
        onFullscreen={onFullscreen}
        showFullscreen
        className="mx-auto"
      />
    </NodeTopBar>
  );
}
