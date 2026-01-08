// file: app/materials/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitialState, loadState, saveState } from '@/lib/storage';

export default function MaterialsPage() {
  const [state, setState] = useState(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded ?? getInitialState());
  }, []);

  useEffect(() => {
    if (!state) return;
    saveState(state);
  }, [state]);

  const materials = useMemo(() => state?.materials ?? [], [state]);

  function addMaterial() {
    const id = `mat_${Date.now()}`;
    const next = { id, name: '新規材質', unitWeightNote: '未設定' };
    setState((s) => ({ ...s, materials: [next, ...(s.materials ?? [])] }));
  }

  function updateMaterial(id, patch) {
    setState((s) => ({
      ...s,
      materials: (s.materials ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function removeMaterial(id) {
    setState((s) => ({
      ...s,
      materials: (s.materials ?? []).filter((m) => m.id !== id),
    }));
  }

  if (!state) return <div>読み込み中...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">材質管理（単位重量の登録）</h1>
        <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" onClick={addMaterial}>
          + 追加
        </button>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
        ここに「単位あたりの重さ」を入力して、後で 3Dモデルの体積×密度 で重さを出します。<br />
        「穴・切欠き考慮あり/なし」もこの先で分けて表示します。
      </div>

      <div className="grid gap-3">
        {materials.map((m) => (
          <div key={m.id} className="rounded-2xl border p-4 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 rounded-lg border px-3 py-1 text-sm"
                value={m.name}
                onChange={(e) => updateMaterial(m.id, { name: e.target.value })}
              />
              <button
                className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
                onClick={() => removeMaterial(m.id)}
              >
                削除
              </button>
            </div>

            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="単位重量メモ（例: 7850 kg/m3 など）"
              value={m.unitWeightNote ?? ''}
              onChange={(e) => updateMaterial(m.id, { unitWeightNote: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
