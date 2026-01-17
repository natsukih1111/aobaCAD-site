// file: components/cutting/PlateCuttingTool.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultSheetStocks,
  loadSheetStocks,
  normalizeSheetStocks,
  saveSheetStocks,
} from '@/lib/cutting/sheetStockTable';
import { solveSheetCutting } from '@/lib/cutting/solveSheetCutting';
import SheetLayoutDiagram from '@/components/cutting/SheetLayoutDiagram';

function toInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

// 同じ切り方キー（この組み合わせが同じなら同一パターン）
function placementKey(pl) {
  const id = pl?.sheet?.id || 'remnant';
  const name = pl?.sheet?.name || '';
  const w = pl?.sheet?.w || 0;
  const h = pl?.sheet?.h || 0;
  const dir = pl?.dir || '';
  const nx = pl?.nx || 0;
  const ny = pl?.ny || 0;
  const pw = pl?.partW || 0;
  const ph = pl?.partH || 0;
  const made = pl?.made || 0; // madeが違うのは基本別パターンとして扱う
  return `${id}|${name}|${w}x${h}|${dir}|${nx}x${ny}|${pw}x${ph}|made:${made}`;
}

// 連続する同一パターンだけまとめる（No.1~11表記が綺麗）
function groupConsecutivePlacements(list) {
  const out = [];
  let currentNo = 1;

  for (const pl of list || []) {
    if (out.length === 0) {
      out.push({ ...pl, _startNo: currentNo, _endNo: currentNo, _count: 1 });
      currentNo += 1;
      continue;
    }
    const last = out[out.length - 1];
    const same = placementKey(last) === placementKey(pl);
    if (same) {
      last._endNo += 1;
      last._count += 1;
      currentNo += 1;
    } else {
      out.push({ ...pl, _startNo: currentNo, _endNo: currentNo, _count: 1 });
      currentNo += 1;
    }
  }

  return out;
}

export default function PlateCuttingTool() {
  const [comment, setComment] = useState('');

  // 必要寸法（複数）
  const [rows, setRows] = useState([{ w: 500, h: 300, qty: 10 }]);

  // 端材（複数）
  const [remnants, setRemnants] = useState([]);

  // 定尺（編集可能）
  const [stocks, setStocks] = useState(getDefaultSheetStocks());
  const [newName, setNewName] = useState('3x6');
  const [newW, setNewW] = useState('914');
  const [newH, setNewH] = useState('1829');

  const [result, setResult] = useState(null);

  // ★表示オプション
  const [groupSame, setGroupSame] = useState(true);
  const [showDiagram, setShowDiagram] = useState(true);
  const [showDims, setShowDims] = useState(true);

  useEffect(() => {
    setStocks(loadSheetStocks());
  }, []);

  useEffect(() => {
    saveSheetStocks(stocks);
  }, [stocks]);

  function addRow() {
    setRows((p) => [...p, { w: 300, h: 300, qty: 1 }]);
  }
  function removeRow(idx) {
    setRows((p) => p.filter((_, i) => i !== idx));
  }
  function updateRow(idx, key, value) {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRemnant() {
    setRemnants((p) => [...p, { w: 914, h: 1829, qty: 1 }]);
  }
  function removeRemnant(idx) {
    setRemnants((p) => p.filter((_, i) => i !== idx));
  }
  function updateRemnant(idx, key, value) {
    setRemnants((p) => p.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addStock() {
    const item = {
      id: `${String(newName).trim() || `${newW}x${newH}`}`,
      name: String(newName).trim() || `${newW}x${newH}`,
      w: toInt(newW),
      h: toInt(newH),
    };
    const next = normalizeSheetStocks([...(stocks || []), item]);
    setStocks(next);
    setResult(null);
  }
  function removeStock(id) {
    setStocks((prev) => normalizeSheetStocks((prev || []).filter((x) => x.id !== id)));
    setResult(null);
  }
  function resetStocks() {
    setStocks(getDefaultSheetStocks());
    setResult(null);
  }

  function run() {
    const cleanedRows = rows
      .map((r) => ({ w: toInt(r.w), h: toInt(r.h), qty: toInt(r.qty) }))
      .filter((r) => r.w > 0 && r.h > 0 && r.qty > 0);

    const cleanedRem = remnants
      .map((r) => ({ w: toInt(r.w), h: toInt(r.h), qty: toInt(r.qty) }))
      .filter((r) => r.w > 0 && r.h > 0 && r.qty > 0);

    const out = solveSheetCutting({
      stocks,
      rows: cleanedRows,
      remnants: cleanedRem,
      options: { ignoreDirection: true }, // 鉄板は方向自由
    });

    setResult(out);
  }

  const plan = result?.ok ? result.plan : null;

  const displayPlacements = useMemo(() => {
    if (!plan) return [];
    const list = plan.placements || [];
    return groupSame ? groupConsecutivePlacements(list) : list.map((pl, i) => ({ ...pl, _startNo: i + 1, _endNo: i + 1, _count: 1 }));
  }, [plan, groupSame]);

  return (
    <div className="space-y-4">
      {/* 入力 */}
      <div className="rounded-xl border p-4 space-y-4">
        <input
          className="w-full rounded-lg border px-3 py-3 text-lg font-semibold print:text-2xl print:font-bold print:border-2 print:border-black"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="コメント（例：○○工事 鉄板 t=9）"
        />

        {/* 定尺編集（印刷で消す） */}
        <div className="rounded-xl border p-3 space-y-2 print:hidden">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">定尺（追加/削除OK）</div>
            <button className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm" onClick={resetStocks}>
              デフォルトに戻す
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input className="w-24 rounded-lg border px-3 py-2" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名前" />
            <input className="w-28 rounded-lg border px-3 py-2" value={newW} onChange={(e) => setNewW(e.target.value)} placeholder="W(mm)" />
            <input className="w-28 rounded-lg border px-3 py-2" value={newH} onChange={(e) => setNewH(e.target.value)} placeholder="H(mm)" />
            <button className="rounded-lg border px-3 py-2 hover:bg-gray-50" onClick={addStock}>
              追加
            </button>
          </div>

          {stocks.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {stocks.map((s) => (
                <button
                  key={s.id}
                  className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => removeStock(s.id)}
                  title="クリックで削除"
                >
                  {s.name}({s.w}×{s.h}) ✕
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 必要寸法（複数） */}
        <div className="space-y-2">
          <div className="text-sm font-semibold print:text-lg">必要寸法（横×縦×枚数）</div>

          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                <input className="w-28 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.w} onChange={(e) => updateRow(idx, 'w', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">mm（横）</div>

                <input className="w-28 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.h} onChange={(e) => updateRow(idx, 'h', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">mm（縦）</div>

                <input className="w-24 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.qty} onChange={(e) => updateRow(idx, 'qty', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">枚</div>

                <button
                  className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden"
                  onClick={() => removeRow(idx)}
                  disabled={rows.length <= 1}
                  title={rows.length <= 1 ? '最低1行必要です' : '削除'}
                >
                  削除
                </button>
              </div>
            ))}
          </div>

          <button className="rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden" onClick={addRow}>
            行を追加
          </button>
        </div>

        {/* 端材（複数） */}
        <div className="border-t pt-4 space-y-2">
          <div className="text-sm font-semibold print:text-lg">在庫端材（横×縦×枚数）</div>

          {remnants.length === 0 && <div className="text-sm text-gray-600 print:text-black">端材なし</div>}

          <div className="space-y-2">
            {remnants.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                <input className="w-28 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.w} onChange={(e) => updateRemnant(idx, 'w', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">mm（横）</div>

                <input className="w-28 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.h} onChange={(e) => updateRemnant(idx, 'h', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">mm（縦）</div>

                <input className="w-24 rounded-lg border px-3 py-2 print:border-black" type="number" value={r.qty} onChange={(e) => updateRemnant(idx, 'qty', e.target.value)} />
                <div className="text-sm text-gray-600 print:text-black">枚</div>

                <button className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden" onClick={() => removeRemnant(idx)}>
                  削除
                </button>
              </div>
            ))}
          </div>

          <button className="rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden" onClick={addRemnant}>
            端材を追加
          </button>
        </div>

        <button className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90 print:hidden" onClick={run}>
          計算する
        </button>
      </div>

      {/* 結果 */}
      <div className="rounded-xl border p-4 print:border-black print:text-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="font-semibold print:text-xl">結果</div>

          {plan && (
            <div className="ml-auto flex items-center gap-2 print:hidden">
              <button
                className="rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm"
                onClick={() => setGroupSame((v) => !v)}
                title="同じ切り方が連続している所をまとめます"
              >
                {groupSame ? 'まとめ解除' : '同じ切り方をまとめる'}
              </button>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showDiagram} onChange={(e) => setShowDiagram(e.target.checked)} />
                図を表示
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDims}
                  onChange={(e) => setShowDims(e.target.checked)}
                  disabled={!showDiagram}
                />
                寸法を表示
              </label>
            </div>
          )}
        </div>

        {!result && <div className="text-sm text-gray-600 print:hidden">「計算する」を押してください。</div>}
        {result && !result.ok && <div className="text-sm text-red-600 print:text-black">{result.error}</div>}

        {plan && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 border p-3 space-y-1 print:bg-white print:border-black">
              <div>
                <span className="font-semibold">端材使用：</span>{plan.usedRemnantsCount}枚　
                <span className="font-semibold ml-3">購入枚数：</span>{plan.purchasedSheetsCount}枚
              </div>

              <div className="text-sm text-gray-700 print:text-black">
                <span className="font-semibold">購入内訳：</span>
                {Object.keys(plan.byPurchasedStock).length === 0
                  ? '購入なし'
                  : Object.entries(plan.byPurchasedStock)
                      .map(([id, c]) => {
                        const st = (stocks || []).find((s) => s.id === id);
                        return st ? `${st.name}(${st.w}×${st.h}) × ${c}枚` : `${id} × ${c}枚`;
                      })
                      .join(' / ')}
              </div>
            </div>

            {/* ★印刷時「種類ごとに改ページしない」＝ 強制改ページクラスを入れない */}
            <div className="space-y-3">
              {displayPlacements.map((pl, i) => {
                const range = pl._endNo > pl._startNo ? `No.${pl._startNo}~${pl._endNo}` : `No.${pl._startNo}`;
                const countText = pl._count > 1 ? `×${pl._count}枚` : '';

                return (
                  <div key={i} className="rounded-lg border p-3 print:border-black print:[break-inside:avoid]">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{range}</div>

                      <div className="text-sm print:text-lg">
                        {pl.source === 'remnant' ? '端材' : '購入'}：
                        <span className="font-semibold ml-1">
                          {pl.sheet.name}（{pl.sheet.w}×{pl.sheet.h}）
                        </span>
                        <span className="ml-3">
                          作成：<span className="font-semibold">{pl.made}枚</span>
                        </span>
                        <span className="ml-3">
                          使用寸法：<span className="font-semibold">{pl.partW}×{pl.partH}</span>
                        </span>
                      </div>

                      {/* ★×○○枚 */}
                      {countText && (
                        <div className="ml-auto font-bold text-sm print:text-lg">
                          {countText}
                        </div>
                      )}
                    </div>

                    {/* 図 */}
                    {showDiagram && (
                      <div className="mt-3">
                        <SheetLayoutDiagram
                          stockW={pl.sheet.w}
                          stockH={pl.sheet.h}
                          nx={pl.nx}
                          ny={pl.ny}
                          partW={pl.partW}
                          partH={pl.partH}
                          showDims={showDims}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
