import React, { useState } from 'react';
import { TiptapEditor } from '../components/TiptapEditor';

export const EditorPage: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF7F2] dark:bg-[#151413]">
      <TiptapEditor
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen((prev) => !prev)}
      />
    </div>
  );
};
