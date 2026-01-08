// file: components/SketchHelpText.js
'use client';

export default function SketchHelpText({ currentTool }) {
  if (!currentTool?.startsWith('sketch-')) return null;

  const map = {
    'sketch-line': '線分：クリック→クリック',
    'sketch-circle': '円：中心クリック→半径点クリック',
    'sketch-chamfer': '面取り：線が2本以上ある状態でクリック2回（簡易）',
    'sketch-trim': 'トリム：線が2本以上ある状態でクリック2回（簡易）',
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-[72px] -translate-x-1/2 z-50">
      <div className="rounded-full bg-white/90 border px-3 py-1 text-xs shadow">
        {map[currentTool] ?? '作図'}
      </div>
    </div>
  );
}
