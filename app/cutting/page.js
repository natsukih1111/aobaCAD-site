// file: app/cutting/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import CuttingTool from '@/components/cutting/CuttingTool';
import PlateCuttingTool from '@/components/cutting/PlateCuttingTool';
import ExpandedCuttingTool from '@/components/cutting/ExpandedCuttingTool';

export default function CuttingPage() {
  const [mode, setMode] = useState('bar'); // bar | plate | expanded

  return (
    <div className="space-y-4">
      {/* ✅見出し（印刷しない） */}
      <div className="space-y-1 print:hidden">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-2xl font-bold">材料取り（切断表）</h1>

          {/* ★使い方リンク（印刷に出ない） */}
          <Link
            href="/cutting/help"
            className="shrink-0 rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm font-semibold"
          >
            使い方
          </Link>
        </div>

        <p className="text-sm text-gray-600">
          必要な寸法と数量を入れると、材料の買い方と切断表を作ります。
        </p>
      </div>

      {/* ✅材料カテゴリ */}
      <div className="rounded-xl border p-4 space-y-3 print:hidden">
        <div className="text-sm font-semibold">材料カテゴリ</div>
        <select
          className="w-full max-w-[240px] rounded-lg border px-3 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="bar">棒材（FB / L / U / H / SGP / I / 角パイプ）</option>
          <option value="plate">鉄板（3×6 / 4×8 / 5×10）</option>
          <option value="expanded">エキスパンドメタル（畳目 / そろばん目）</option>
        </select>
      </div>

      {/* ✅表示切り替え */}
      {mode === 'bar' && <CuttingTool />}
      {mode === 'plate' && <PlateCuttingTool />}
      {mode === 'expanded' && <ExpandedCuttingTool />}
    </div>
  );
}
