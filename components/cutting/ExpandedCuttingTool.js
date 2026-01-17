// file: components/cutting/ExpandedCuttingTool.js
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

function meshLabel(k) {
  // UIのラベル（あなたが見たい表示）
  return k === 'tatami' ? '畳目' : 'そろばん目';
}

// ★図に渡すmeshKindが逆だったので、渡す直前だけ反転する
function toDiagramMeshKind(uiKind) {
  return uiKind === 'tatami' ? 'soroban' : 'tatami';
}

// まとめ判定キー：meshKindも含める（畳目とそろばん目は別パターン）
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
  const made = pl?.made || 0;
  const meshKind = pl?.meshKind || 'tatami';
  return `${meshKind}|${id}|${name}|${w}x${h}|${dir}|${nx}x${ny}|${pw}x${ph}|made:${made}`;
}

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

function meshOrderFromRows(rows) {
  const seen = new Set();
  const order = [];
  for (const r of rows || []) {
    const mk = r?.meshKind || 'tatami';
    if (!seen.has(mk)) {
      seen.add(mk);
      order.push(mk);
    }
  }
  for (const mk of ['tatami', 'soroban']) {
    if (!seen.has(mk)) order.push(mk);
  }
  return order;
}

export default function ExpandedCuttingTool() {
  const [comment, setComment] = useState('');

  // ★混在モード
  const [mixedMode, setMixedMode] = useState(true); // ONなら行ごと網目、OFFなら全体網目
  const [globalMesh, setGlobalMesh] = useState('tatami'); // mixedMode=OFFの時に使う

  // ★方向（共通）
  const [ignoreDir, setIgnoreDir] = useState(false);
  const [preferred, setPreferred] = useState('auto'); // auto | A | B

  // ★必要寸法（行ごと meshKind）
  const [rows, setRows] = useState([{ w: 500, h: 300, qty: 10, meshKind: 'tatami' }]);

  // ★端材（行ごと meshKind）
  const [remnants, setRemnants] = useState([]);

  const [stocks, setStocks] = useState(getDefaultSheetStocks());
  const [newName, setNewName] = useState('3x6');
  const [newW, setNewW] = useState('914');
  const [newH, setNewH] = useState('1829');

  const [result, setResult] = useState(null);

  // 表示オプション
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
    setRows((p) => [...p, { w: 300, h: 300, qty: 1, meshKind: globalMesh }]);
  }
  function removeRow(idx) {
    setRows((p) => p.filter((_, i) => i !== idx));
  }
  function updateRow(idx, key, value) {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRemnant() {
    setRemnants((p) => [...p, { w: 914, h: 1829, qty: 1, meshKind: globalMesh }]);
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
    const cleanedRowsRaw = rows
      .map((r) => ({
        w: toInt(r.w),
        h: toInt(r.h),
        qty: toInt(r.qty),
        meshKind: r.meshKind === 'soroban' ? 'soroban' : 'tatami',
      }))
      .filter((r) => r.w > 0 && r.h > 0 && r.qty > 0);

    const cleanedRemRaw = remnants
      .map((r) => ({
        w: toInt(r.w),
        h: toInt(r.h),
        qty: toInt(r.qty),
        meshKind: r.meshKind === 'soroban' ? 'soroban' : 'tatami',
      }))
      .filter((r) => r.w > 0 && r.h > 0 && r.qty > 0);

    // ★混在OFFなら、全行をglobalMeshで上書き
    const cleanedRows = mixedMode
      ? cleanedRowsRaw
      : cleanedRowsRaw.map((r) => ({ ...r, meshKind: globalMesh }));
    const cleanedRem = mixedMode
      ? cleanedRemRaw
      : cleanedRemRaw.map((r) => ({ ...r, meshKind: globalMesh }));

    const forceDirection = ignoreDir ? null : preferred === 'auto' ? null : preferred; // 'A' or 'B'

    // ★meshKind別に分割して計算 → placementsを合体
    const order = mixedMode ? meshOrderFromRows(cleanedRows) : [globalMesh];

    const groupRows = { tatami: [], soroban: [] };
    const groupRems = { tatami: [], soroban: [] };

    for (const r of cleanedRows) groupRows[r.meshKind].push(r);
    for (const r of cleanedRem) groupRems[r.meshKind].push(r);

    const plans = [];
    let okAll = true;
    let err = null;

    for (const mk of order) {
      const rowsOf = groupRows[mk] || [];
      if (rowsOf.length === 0) continue;

      const out = solveSheetCutting({
        stocks,
        rows: rowsOf,
        remnants: groupRems[mk] || [],
        options: {
          ignoreDirection: ignoreDir,
          forceDirection,
        },
      });

      if (!out?.ok) {
        okAll = false;
        err = out?.error || '計算に失敗しました。';
        break;
      }

      plans.push({ meshKind: mk, plan: out.plan });
    }

    if (!okAll) {
      setResult({ ok: false, error: err, plans: [] });
      return;
    }

    // 合計サマリ
    let usedRemnantsCount = 0;
    let purchasedSheetsCount = 0;

    const placementsAll = [];
    const meta = {
      ignoreDirection: ignoreDir,
      forceDirection,
      mixedMode,
      globalMesh,
    };

    for (const p of plans) {
      usedRemnantsCount += Number(p.plan?.usedRemnantsCount || 0);
      purchasedSheetsCount += Number(p.plan?.purchasedSheetsCount || 0);

      for (const pl of p.plan?.placements || []) {
        placementsAll.push({ ...pl, meshKind: p.meshKind });
      }
    }

    setResult({
      ok: true,
      error: null,
      plan: {
        meta,
        placements: placementsAll,
        usedRemnantsCount,
        purchasedSheetsCount,
      },
      plans,
    });
  }

  const plan = result?.ok ? result.plan : null;

  const displayPlacements = useMemo(() => {
    if (!plan) return [];
    const list = plan.placements || [];
    const numbered = list.map((pl, i) => ({ ...pl, _startNo: i + 1, _endNo: i + 1, _count: 1 }));
    return groupSame ? groupConsecutivePlacements(numbered) : numbered;
  }, [plan, groupSame]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-4">
        <input
          className="w-full rounded-lg border px-3 py-3 text-lg font-semibold print:text-2xl print:font-bold print:border-2 print:border-black"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="コメント（例：エキスパンド t=4.5）"
        />

        {/* ★混在モード */}
        <div className="flex flex-wrap gap-4 items-center print:text-lg">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mixedMode}
              onChange={(e) => {
                setMixedMode(e.target.checked);
                setResult(null);
              }}
            />
            混在モード（行ごとに畳目/そろばん目を指定）
          </label>

          {!mixedMode && (
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">網目（全体）</div>
              <select
                className="rounded-lg border px-3 py-2"
                value={globalMesh}
                onChange={(e) => {
                  setGlobalMesh(e.target.value);
                  setResult(null);
                }}
              >
                <option value="tatami">畳目</option>
                <option value="soroban">そろばん目</option>
              </select>
            </div>
          )}
        </div>

        {/* 方向設定（共通） */}
        <div className="flex flex-wrap gap-4 items-center print:text-lg">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ignoreDir}
              onChange={(e) => {
                setIgnoreDir(e.target.checked);
                setResult(null);
              }}
            />
            網目方向を気にしない
          </label>

          <div className={ignoreDir ? 'opacity-50 pointer-events-none' : ''}>
            <div className="text-sm font-semibold">切断方向（網目に合わせる）</div>
            <select
              className="rounded-lg border px-3 py-2"
              value={preferred}
              onChange={(e) => {
                setPreferred(e.target.value);
                setResult(null);
              }}
            >
              <option value="auto">自動（多く取れる方）</option>
              <option value="A">縦（入力そのまま）</option>
              <option value="B">横（縦横入替）</option>
            </select>
          </div>
        </div>

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

        {/* 必要寸法 */}
        <div className="space-y-2">
          <div className="text-sm font-semibold print:text-lg">必要寸法（横×縦×枚数）</div>

          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                {/* ★混在ONのときだけ行ごと網目 */}
                <select
                  className={`w-36 rounded-lg border px-3 py-2 print:border-black ${mixedMode ? '' : 'opacity-50 pointer-events-none'}`}
                  value={r.meshKind || 'tatami'}
                  onChange={(e) => updateRow(idx, 'meshKind', e.target.value)}
                  title="この行の材料：畳目 or そろばん目"
                >
                  <option value="tatami">畳目</option>
                  <option value="soroban">そろばん目</option>
                </select>

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

        {/* 端材 */}
        <div className="border-t pt-4 space-y-2">
          <div className="text-sm font-semibold print:text-lg">在庫端材（横×縦×枚数）</div>

          {remnants.length === 0 && <div className="text-sm text-gray-600 print:text-black">端材なし</div>}

          <div className="space-y-2">
            {remnants.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                <select
                  className={`w-36 rounded-lg border px-3 py-2 print:border-black ${mixedMode ? '' : 'opacity-50 pointer-events-none'}`}
                  value={r.meshKind || 'tatami'}
                  onChange={(e) => updateRemnant(idx, 'meshKind', e.target.value)}
                >
                  <option value="tatami">畳目</option>
                  <option value="soroban">そろばん目</option>
                </select>

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
                <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} disabled={!showDiagram} />
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
                <span className="font-semibold">混在：</span>{plan.meta.mixedMode ? 'ON（行ごと）' : `OFF（全体：${meshLabel(plan.meta.globalMesh)}）`}
              </div>
              <div>
                <span className="font-semibold">方向：</span>
                {plan.meta.ignoreDirection
                  ? '気にしない'
                  : plan.meta.forceDirection
                  ? plan.meta.forceDirection === 'A' ? '縦固定' : '横固定'
                  : '自動'}
              </div>
              <div>
                <span className="font-semibold">端材使用：</span>{plan.usedRemnantsCount}枚　
                <span className="font-semibold ml-3">購入枚数：</span>{plan.purchasedSheetsCount}枚
              </div>
            </div>

            <div className="space-y-3">
              {displayPlacements.map((pl, i) => {
                const range = pl._endNo > pl._startNo ? `No.${pl._startNo}~${pl._endNo}` : `No.${pl._startNo}`;
                const countText = pl._count > 1 ? `×${pl._count}枚` : '';
                const mk = pl.meshKind || 'tatami';
                const diagramKind = toDiagramMeshKind(mk); // ★ここで反転

                return (
                  <div key={i} className="rounded-lg border p-3 print:border-black print:[break-inside:avoid]">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{range}</div>

                      <div className="text-sm print:text-lg">
                        網目：<span className="font-semibold">{meshLabel(mk)}</span>
                        <span className="ml-3">
                          {pl.source === 'remnant' ? '端材' : '購入'}：
                          <span className="font-semibold ml-1">
                            {pl.sheet.name}（{pl.sheet.w}×{pl.sheet.h}）
                          </span>
                        </span>
                        <span className="ml-3">
                          作成：<span className="font-semibold">{pl.made}枚</span>
                        </span>
                        <span className="ml-3">
                          使用寸法：<span className="font-semibold">{pl.partW}×{pl.partH}</span>
                        </span>
                        <span className="ml-3">
                          方向：<span className="font-semibold">{pl.dir === 'A' ? '縦' : '横'}</span>
                        </span>
                      </div>

                      {countText && <div className="ml-auto font-bold text-sm print:text-lg">{countText}</div>}
                    </div>

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
                          meshEnabled={true}
                          meshKind={diagramKind} // ★畳/そろばんを逆転して渡す
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
