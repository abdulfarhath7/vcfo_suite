'use client';

import { useBoardResolutionEditorState } from '@/views/intern/useBoardResolutionEditorState';
import { BoardResolutionEditorView } from '@/views/intern/BoardResolutionEditorView';

export default function BoardResolutionEditor() {
  const vm = useBoardResolutionEditorState({});
  if (!vm.eng) {
    return (
      <div className="p-6 text-[13px] text-text-secondary">
        This project isn&apos;t in your portfolio — it may have been removed or you don&apos;t have
        access.
      </div>
    );
  }
  return <BoardResolutionEditorView {...vm} />;
}
