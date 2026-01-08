// file: components/steel/steelCatalog.js
'use client';

/**
 * public/steel_catalog.xlsx を読み込んで
 * { channels: [...], angles: [...] } を返す
 *
 * Excel例:
 * 1行目: "チャンネル" のタイトル行（ヘッダじゃない）
 * 2行目: "呼び名 | H | B | t1 | t2 | r1 | r2"
 * 3行目以降: データ
 *
 * → ヘッダ行を自動で探して、その行からテーブル化する
 */

const DEFAULT_URL = '/steel_catalog.xlsx';

let _cache = null;

/** 文字列の正規化 */
function s(v) {
  return String(v ?? '').trim();
}

/** 数値化 */
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

/** ヘッダとして扱うキーを正規化（表記ゆれ吸収） */
function normalizeHeaderKey(key) {
  const k = s(key);
  if (!k) return '';
  const low = k.toLowerCase();

  // name系
  if (low === 'name' || low === '規格' || low === '呼び名' || low === '呼称' || low === '名称') return 'name';

  // そのまま使う系（大文字小文字吸収）
  if (low === 'h') return 'H';
  if (low === 'b') return 'B';
  if (low === 'a') return 'A';
  if (low === 't') return 't';
  if (low === 't1') return 't1';
  if (low === 't2') return 't2';
  if (low === 'r1') return 'r1';
  if (low === 'r2') return 'r2';

  // 日本語の可能性（必要なら追加）
  if (k === '高さ') return 'H';
  if (k === '幅') return 'B';
  if (k === '板厚') return 't';

  // unknownは捨てる（将来、重量など使いたければここを拡張）
  return '';
}

/**
 * AOA(Array of Arrays) から
 * ヘッダ行を探して rows を作る
 */
function aoaToRowsWithHeaderDetect(aoa) {
  if (!Array.isArray(aoa) || aoa.length === 0) return [];

  // 先頭から最大50行くらい探す
  const limit = Math.min(50, aoa.length);

  let headerRowIndex = -1;
  let headerMap = null; // [{idx, key}...]

  const isGoodHeader = (row) => {
    if (!Array.isArray(row)) return null;
    const keys = row.map((c) => normalizeHeaderKey(c)).filter(Boolean);

    // name と、H/B などが最低限入ってる行をヘッダとみなす
    const hasName = keys.includes('name');
    const hasHB = keys.includes('H') && keys.includes('B');
    // 角鋼の場合 A/B/t などもあるので、もう少し緩くしてもOK
    const hasAnyDim = keys.some((k) => ['H', 'B', 'A', 't', 't1', 't2', 'r1', 'r2'].includes(k));

    if (hasName && (hasHB || hasAnyDim)) {
      // headerMapを作る（列番号→canonical key）
      const map = row
        .map((c, idx) => ({ idx, key: normalizeHeaderKey(c) }))
        .filter((x) => x.key);

      // nameが複数列に出てたら最初を採用
      return map;
    }
    return null;
  };

  for (let i = 0; i < limit; i++) {
    const map = isGoodHeader(aoa[i]);
    if (map) {
      headerRowIndex = i;
      headerMap = map;
      break;
    }
  }

  if (headerRowIndex < 0 || !headerMap) return [];

  // データ行は headerRowIndex+1 から
  const rows = [];
  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;

    const obj = {};
    for (const col of headerMap) {
      const v = row[col.idx];
      obj[col.key] = v;
    }

    const name = s(obj.name);
    if (!name) continue;

    const out = { name };

    // 数値系をNumber化
    for (const key of ['H', 'B', 'A', 't', 't1', 't2', 'r1', 'r2']) {
      if (obj[key] === undefined || obj[key] === null || obj[key] === '') continue;
      const vv = n(obj[key]);
      out[key] = vv !== undefined ? vv : obj[key];
    }

    rows.push(out);
  }

  return rows;
}

async function readWorkbook(url) {
  const XLSX = await import('xlsx');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Excel fetch failed: ${res.status} ${res.statusText}`);

  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

function findSheet(wb, candidates, fallbackIndex) {
  const names = wb.SheetNames ?? [];
  const lower = names.map((x) => String(x).toLowerCase());

  for (const c of candidates) {
    const idx = lower.findIndex((x) => x === String(c).toLowerCase());
    if (idx >= 0) return wb.Sheets[names[idx]];
  }
  if (typeof fallbackIndex === 'number' && names[fallbackIndex]) return wb.Sheets[names[fallbackIndex]];
  return names[0] ? wb.Sheets[names[0]] : null;
}

async function loadSteelCatalogFromExcel(url) {
  const XLSX = await import('xlsx');
  const wb = await readWorkbook(url);

  const sheetChannels = findSheet(wb, ['channels', 'channel', 'ch', 'チャンネル', 'チャンネル形鋼'], 0);
  const sheetAngles = findSheet(wb, ['angles', 'angle', 'l', 'アングル', '等辺山形鋼', '不等辺山形鋼'], 1);

  const toAOA = (sheet) => {
    if (!sheet) return [];
    // header:1 で「配列の配列」にする（＝ヘッダ検出しやすい）
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  };

  const channels = aoaToRowsWithHeaderDetect(toAOA(sheetChannels));
  const angles = aoaToRowsWithHeaderDetect(toAOA(sheetAngles));

  return { channels, angles };
}

export async function fetchSteelCatalog(url = DEFAULT_URL) {
  if (_cache) return _cache;
  _cache = loadSteelCatalogFromExcel(url);
  return _cache;
}
