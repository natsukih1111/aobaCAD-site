// file: components/steel/SteelAddPanel.js
'use client';

import { STEEL_ANGLES, STEEL_CHANNELS } from '@/components/steel/steelCatalog';

export default function SteelAddPanel({ draft, setDraft, onPlace, onCancel }) {
  if (!draft) return null;

  const kind = draft.kind ?? 'channel';
  const length = draft.length ?? 1000;

  const list = kind === 'channel' ? STEEL_CHANNELS : STEEL_ANGLES;

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="text-xs font-semibold">鋼材追加（mm）</div>
      <div className="text-[11px] text-gray-500">規格と長さを入力して「配置」</div>

      <div className="flex gap-2">
        <button
          className={`flex-1 rounded border px-2 py-1 text-xs ${
            kind === 'channel' ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300' : 'bg-white hover:bg-gray-50'
          }`}
          type="button"
          onClick={() => setDraft((d) => ({ ...d, kind: 'channel', name: STEEL_CHANNELS[0]?.name ?? 'U75' }))}
        >
          チャンネル
        </button>
        <button
          className={`flex-1 rounded border px-2 py-1 text-xs ${
            kind === 'angle' ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300' : 'bg-white hover:bg-gray-50'
          }`}
          type="button"
          onClick={() => setDraft((d) => ({ ...d, kind: 'angle', name: STEEL_ANGLES[0]?.name ?? 'L50x6' }))}
        >
          Lアングル
        </button>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">規格</div>
        <select
          className="w-full rounded border px-2 py-1 text-xs"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        >
          {list.map((x) => (
            <option key={x.name} value={x.name}>
              {x.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">長さ L(mm)</div>
        <input
          className="w-full rounded border px-2 py-1 text-xs"
          type="number"
          step="1"
          value={length}
          onChange={(e) => setDraft((d) => ({ ...d, length: Number(e.target.value) }))}
        />
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={onPlace}>
          配置
        </button>
        <button className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>

      <div className="text-[11px] text-gray-500">
        ※今は「外形サイズの箱」で仮配置。あとで断面形状（t1/t2/r）を反映して本物の形にできます。
      </div>
    </div>
  );
}
