// file: lib/cutting/sheetStockTable.js

export const SHEET_STOCK_STORAGE_KEY = 'cadsite_sheet_stock_table_v1';

// 鉄板・エキスパンド共通の定尺
export function getDefaultSheetStocks() {
  return [
    { id: '3x6', name: '3x6', w: 914, h: 1829 },
    { id: '4x8', name: '4x8', w: 1219, h: 2438 },
    { id: '5x10', name: '5x10', w: 1524, h: 3048 },
  ];
}

export function normalizeSheetStocks(list) {
  const out = [];
  const seen = new Set();

  for (const it of list || []) {
    const name = String(it?.name || '').trim();
    const w = Math.round(Number(it?.w));
    const h = Math.round(Number(it?.h));
    const id = String(it?.id || name || `${w}x${h}`).trim();

    if (!name || !Number.isFinite(w) || !Number.isFinite(h)) continue;
    if (w <= 0 || h <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({ id, name, w, h });
  }

  // 面積の小さい順（見やすさ）
  out.sort((a, b) => a.w * a.h - b.w * b.h);
  return out;
}

export function loadSheetStocks() {
  if (typeof window === 'undefined') return getDefaultSheetStocks();
  try {
    const raw = localStorage.getItem(SHEET_STOCK_STORAGE_KEY);
    if (!raw) return getDefaultSheetStocks();
    const parsed = JSON.parse(raw);
    const norm = normalizeSheetStocks(parsed);
    return norm.length ? norm : getDefaultSheetStocks();
  } catch {
    return getDefaultSheetStocks();
  }
}

export function saveSheetStocks(stocks) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHEET_STOCK_STORAGE_KEY, JSON.stringify(stocks));
}
