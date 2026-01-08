// file: components/cutting/CuttingTool.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TYPE_LIST,
  STOCK_TABLE_STORAGE_KEY,
  getDefaultTable,
  normalizeStockList,
} from '@/lib/cutting/stockTable';
import { solveCutting } from '@/lib/cutting/solveCutting';

function toInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// 同じ切り方判定キー（材料/定尺長/切断リスト/端材/切断しろ合計 が同じなら同一パターン）
function barKey(bar) {
  const cutsKey = Array.isArray(bar.cuts) ? bar.cuts.join(',') : '';
  return `${bar.source}|${bar.stockLen}|${bar.remain}|${bar.kerfTotal}|${cutsKey}`;
}

// 連続する同一パターンだけまとめる（Noの範囲表示が綺麗になる）
function groupConsecutiveBars(bars) {
  const out = [];
  let currentNo = 1;

  for (let i = 0; i < (bars || []).length; i++) {
    const b = bars[i];
    const rep = Math.max(1, Number(b.repeat || 1));

    if (out.length === 0) {
      out.push({
        ...b,
        _startNo: currentNo,
        _endNo: currentNo + rep - 1,
        _count: rep,
      });
      currentNo += rep;
      continue;
    }

    const last = out[out.length - 1];
    const same = barKey(last) === barKey(b);

    if (same) {
      last._endNo += rep;
      last._count += rep;
      currentNo += rep;
    } else {
      out.push({
        ...b,
        _startNo: currentNo,
        _endNo: currentNo + rep - 1,
        _count: rep,
      });
      currentNo += rep;
    }
  }

  return out;
}

// まとめない時でも No を正しく振る（repeat対応）
function addNumbering(bars) {
  const out = [];
  let currentNo = 1;
  for (const b of bars || []) {
    const rep = Math.max(1, Number(b.repeat || 1));
    out.push({
      ...b,
      _startNo: currentNo,
      _endNo: currentNo + rep - 1,
      _count: rep,
    });
    currentNo += rep;
  }
  return out;
}

export default function CuttingTool() {
  const [type, setType] = useState('L');
  const [comment, setComment] = useState('');

  const [kerfEnabled, setKerfEnabled] = useState(true);
  const kerfMm = kerfEnabled ? 3 : 0; // ★切断しろ 3mm

  // ★重ね切りモード（歩留まり無視）
  const [stackingMode, setStackingMode] = useState(false);

  const [rows, setRows] = useState([
    { length: 1500, qty: 2 },
    { length: 1800, qty: 2 },
    { length: 2000, qty: 2 },
  ]);

  const [remnants, setRemnants] = useState([]);
  const [result, setResult] = useState(null);

  // ★定尺テーブル（ユーザー編集可能）
  const [stockTable, setStockTable] = useState(getDefaultTable());
  const [newStockLen, setNewStockLen] = useState('6000');

  // ★結果のまとめ表示（歩留まり優先でも使う）
  const [groupSamePattern, setGroupSamePattern] = useState(true);

  // 初回ロード（localStorage）
  useEffect(() => {
    const raw =
      typeof window !== 'undefined'
        ? localStorage.getItem(STOCK_TABLE_STORAGE_KEY)
        : null;
    const parsed = raw ? safeJsonParse(raw) : null;

    const base = getDefaultTable();
    if (parsed && typeof parsed === 'object') {
      for (const k of TYPE_LIST) {
        if (parsed[k]) base[k] = normalizeStockList(parsed[k]);
      }
    }
    setStockTable(base);
  }, []);

  // 保存（stockTableが変わったら保存）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STOCK_TABLE_STORAGE_KEY, JSON.stringify(stockTable));
  }, [stockTable]);

  const stockLengths = useMemo(() => stockTable[type] || [], [stockTable, type]);

  function addRow() {
    setRows((prev) => [...prev, { length: 1000, qty: 1 }]);
  }
  function removeRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateRow(idx, key, value) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  }

  function addRemnantRow() {
    setRemnants((prev) => [...prev, { length: 3000, qty: 1 }]);
  }
  function removeRemnantRow(idx) {
    setRemnants((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateRemnantRow(idx, key, value) {
    setRemnants((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  }

  // ★定尺の追加/削除
  function addStockLength() {
    const v = toInt(newStockLen);
    if (v <= 0) return;

    setStockTable((prev) => {
      const next = { ...prev };
      const list = normalizeStockList([...(next[type] || []), v]);
      next[type] = list;
      return next;
    });

    setResult(null);
  }

  function removeStockLength(len) {
    setStockTable((prev) => {
      const next = { ...prev };
      next[type] = normalizeStockList((next[type] || []).filter((x) => x !== len));
      return next;
    });
    setResult(null);
  }

  function resetStockLengthToDefault() {
    const defaults = getDefaultTable();
    setStockTable((prev) => ({ ...prev, [type]: defaults[type] }));
    setResult(null);
  }

  function runSolve() {
    const cleaned = rows
      .map((r) => ({ length: toInt(r.length), qty: toInt(r.qty) }))
      .filter((r) => r.length > 0 && r.qty > 0);

    const cleanedRem = remnants
      .map((r) => ({ length: toInt(r.length), qty: toInt(r.qty) }))
      .filter((r) => r.length > 0 && r.qty > 0);

    const out = solveCutting({
      stockLengths,
      rows: cleaned,
      options: { kerfMm, remnants: cleanedRem, stackingMode },
    });

    setResult(out);
  }

  const displayBars = useMemo(() => {
    if (!result || !result.ok) return [];
    const numbered = addNumbering(result.bars || []);
    return groupSamePattern ? groupConsecutiveBars(numbered) : numbered;
  }, [result, groupSamePattern]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-4">
        {/* ここは印刷しない（種類の行） */}
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="min-w-[180px]">
            <div className="text-sm font-semibold mb-1">種類</div>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setResult(null);
              }}
            >
              {TYPE_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button
            className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90"
            onClick={runSolve}
          >
            計算する
          </button>
        </div>

        {/* 印刷はここから開始（コメント入力） */}
        <div className="space-y-2 print:mt-0">
          <input
            className="w-full rounded-lg border px-3 py-3 text-lg font-semibold print:text-2xl print:font-bold print:border-2 print:border-black"
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメント（例：㈱○○　梁材　L50x6）"
          />
        </div>

        {/* 定尺編集は印刷時に消す */}
        <div className="rounded-xl border p-3 space-y-2 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">定尺（購入できる）</div>
            <button
              className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm"
              onClick={resetStockLengthToDefault}
              title="この種類だけデフォルトに戻す"
            >
              デフォルトに戻す
            </button>
          </div>

          <div className="text-sm text-gray-700">
            {stockLengths.length === 0 ? (
              <span className="text-red-600">定尺が0件です（追加してください）</span>
            ) : (
              <span>{stockLengths.join(', ')} mm</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-40 rounded-lg border px-3 py-2"
              type="number"
              inputMode="numeric"
              value={newStockLen}
              onChange={(e) => setNewStockLen(e.target.value)}
              placeholder="追加する定尺(mm)"
            />
            <button
              className="rounded-lg border px-3 py-2 hover:bg-gray-50"
              onClick={addStockLength}
            >
              定尺を追加
            </button>
          </div>

          {stockLengths.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {stockLengths.map((len) => (
                <button
                  key={len}
                  className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => removeStockLength(len)}
                  title="クリックで削除"
                >
                  {len}mm ✕
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 切断しろ + 重ね切り */}
        <div className="flex flex-wrap items-center gap-6 print:text-lg">
          <label className="flex items-center gap-2 text-sm print:text-lg">
            <input
              type="checkbox"
              checked={kerfEnabled}
              onChange={(e) => {
                setKerfEnabled(e.target.checked);
                setResult(null);
              }}
            />
            切断しろ（3mm）を考慮する
          </label>

          <label className="flex items-center gap-2 text-sm print:text-lg">
            <input
              type="checkbox"
              checked={stackingMode}
              onChange={(e) => {
                setStackingMode(e.target.checked);
                setResult(null);
              }}
            />
            重ね切りモード（歩留まり無視）
          </label>

          <div className="text-xs text-gray-500 print:hidden">
            {stackingMode
              ? '同じ切断パターンをできるだけ繰り返して作ります'
              : '歩留まり（端材の少なさ）優先で作ります'}
          </div>
        </div>

        {/* 必要切断 */}
        <div className="space-y-2">
          <div className="text-sm font-semibold print:text-lg">
            必要な切断（長さ / 本数）
          </div>

          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                <input
                  className="w-40 rounded-lg border px-3 py-2 print:border-black"
                  type="number"
                  inputMode="numeric"
                  value={r.length}
                  onChange={(e) => updateRow(idx, 'length', e.target.value)}
                  placeholder="長さ (mm)"
                />
                <div className="text-sm text-gray-600 print:text-black">mm</div>

                <input
                  className="w-28 rounded-lg border px-3 py-2 print:border-black"
                  type="number"
                  inputMode="numeric"
                  value={r.qty}
                  onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                  placeholder="本数"
                />
                <div className="text-sm text-gray-600 print:text-black">本</div>

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

          <button
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden"
            onClick={addRow}
          >
            行を追加
          </button>
        </div>

        {/* 端材 */}
        <div className="border-t pt-4 space-y-2">
          <div className="text-sm font-semibold print:text-lg">在庫端材（任意・複数OK）</div>

          {remnants.length === 0 && (
            <div className="text-sm text-gray-600 print:text-black">端材なし</div>
          )}

          <div className="space-y-2">
            {remnants.map((r, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 print:text-lg">
                <input
                  className="w-40 rounded-lg border px-3 py-2 print:border-black"
                  type="number"
                  inputMode="numeric"
                  value={r.length}
                  onChange={(e) => updateRemnantRow(idx, 'length', e.target.value)}
                  placeholder="端材長さ (mm)"
                />
                <div className="text-sm text-gray-600 print:text-black">mm</div>

                <input
                  className="w-28 rounded-lg border px-3 py-2 print:border-black"
                  type="number"
                  inputMode="numeric"
                  value={r.qty}
                  onChange={(e) => updateRemnantRow(idx, 'qty', e.target.value)}
                  placeholder="本数"
                />
                <div className="text-sm text-gray-600 print:text-black">本</div>

                <button
                  className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden"
                  onClick={() => removeRemnantRow(idx)}
                  title="削除"
                >
                  削除
                </button>
              </div>
            ))}
          </div>

          <button
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 print:hidden"
            onClick={addRemnantRow}
          >
            端材を追加
          </button>
        </div>
      </div>

      {/* 結果 */}
      <div className="rounded-xl border p-4 print:border-black print:text-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="font-semibold print:text-xl">結果</div>

          {/* ★まとめボタン */}
          {result && result.ok && (
            <button
              className="ml-auto rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm print:hidden"
              onClick={() => setGroupSamePattern((v) => !v)}
              title="同じ切り方が連続している所をまとめます"
            >
              {groupSamePattern ? 'まとめ解除' : '同じ切り方をまとめる'}
            </button>
          )}
        </div>

        {!result && (
          <div className="text-sm text-gray-600 print:hidden">「計算する」を押してください。</div>
        )}

        {result && !result.ok && (
          <div className="text-sm text-red-600 print:text-black">{result.error}</div>
        )}

        {result && result.ok && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 border p-3 text-sm space-y-1 print:bg-white print:border-black print:text-lg">
              <div>
                <span className="font-semibold">モード：</span>
                {stackingMode ? '重ね切り（歩留まり無視）' : '歩留まり優先'}
              </div>

              <div>
                <span className="font-semibold">切断しろ：</span>
                {result.summary.kerfMm} mm
              </div>

              <div>
                <span className="font-semibold">購入本数（定尺のみ）：</span>
                {result.summary.purchasedBarsCount} 本
              </div>

              <div>
                <span className="font-semibold">定尺内訳（購入分）：</span>
                {Object.keys(result.summary.byPurchasedStock).length === 0
                  ? '購入なし'
                  : Object.entries(result.summary.byPurchasedStock)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([k, v]) => `${k}mm × ${v}本`)
                      .join(' / ')}
              </div>
            </div>

            <div className="space-y-3">
              {displayBars.map((bar, i) => {
                const showRange = bar._endNo > bar._startNo;
                const labelNo = showRange
                  ? `No.${bar._startNo}~${bar._endNo}`
                  : `No.${bar._startNo}`;

                return (
                  <div
                    key={i}
                    className={[
                      'rounded-lg border p-3 print:border-black',
                      'print:[break-inside:avoid]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{labelNo}</div>

                      <div className="text-sm print:text-lg">
                        材料：<span className="font-semibold">{bar.stockLen} mm</span>
                        <span className="text-xs text-gray-500 ml-2 print:text-black">
                          （{bar.source === 'remnant' ? '端材' : '購入定尺'}）
                        </span>
                        <span className="ml-3">
                          端材：<span className="font-semibold">{bar.remain} mm</span>
                        </span>
                        <span className="ml-3">
                          切断しろ：<span className="font-semibold">{bar.kerfTotal} mm</span>
                        </span>
                      </div>

                      {bar._count > 1 && (
                        <div className="ml-auto font-bold text-sm print:text-lg">
                          ×{bar._count}本
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-sm text-gray-700 print:text-lg print:text-black">
                      切断： <span className="font-semibold">{bar.cuts.join(' + ')}</span> (mm)
                    </div>
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
