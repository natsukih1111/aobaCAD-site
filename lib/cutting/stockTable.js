// file: lib/cutting/stockTable.js
export const DEFAULT_STOCK_TABLE = {
  FB: [5500, 6000],
  L: [5500, 6000, 7000, 8000, 9000, 10000],
  U: [5500, 6000, 7000, 8000, 9000, 10000],
  H: [6000, 7000, 8000, 9000, 10000],
  SGP: [5500, 6000, 7000, 8000, 9000, 10000],
  I: [5500, 6000, 7000, 8000, 9000, 10000],
  '角パイプ': [6000, 7000, 8000, 9000, 10000],
};

export const TYPE_LIST = Object.keys(DEFAULT_STOCK_TABLE);

export const STOCK_TABLE_STORAGE_KEY = 'cutting_stock_table_v1';

export function normalizeStockList(list) {
  const nums = (list || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n));

  // 重複排除 & 昇順
  const uniq = Array.from(new Set(nums));
  uniq.sort((a, b) => a - b);
  return uniq;
}

export function getDefaultTable() {
  const t = {};
  for (const k of TYPE_LIST) t[k] = normalizeStockList(DEFAULT_STOCK_TABLE[k]);
  return t;
}
