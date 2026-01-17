// file: components/steel/steelCatalog.js
'use client';

import * as XLSX from 'xlsx';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normKey(s) {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .replace(/　/g, '')
    .trim();
}

function pick(row, keys) {
  for (const k of keys) {
    const kk = normKey(k);
    for (const rk of Object.keys(row)) {
      if (normKey(rk) === kk) return row[rk];
    }
  }
  return undefined;
}

function sheetToRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  // 2行目から（range:1）＝ 1行目はヘッダ扱い前提
  return XLSX.utils.sheet_to_json(ws, { defval: '', range: 1 });
}

function findSheetName(wb, candidates) {
  const names = wb.SheetNames || [];
  for (const c of candidates) {
    const hit = names.find((n) => normKey(n) === normKey(c));
    if (hit) return hit;
  }
  return null;
}

export async function fetchSteelCatalog() {
  const warnings = [];
  const sourceUrl = '/steel_catalog.xlsx';

  const res = await fetch(sourceUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Excel fetch failed: ${sourceUrl} (HTTP ${res.status})`);

  const ab = await res.arrayBuffer();
  if (!ab || ab.byteLength < 100) throw new Error(`Excel data too small: ${ab?.byteLength ?? 0} bytes`);

  let wb;
  try {
    wb = XLSX.read(ab, { type: 'array' });
  } catch (e) {
    throw new Error(`XLSX parse failed: ${String(e?.message ?? e)}`);
  }

  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) throw new Error('XLSX parse ok but sheet list is empty');

  // ===== ガス管（円管）=====
  const pipeSheet = findSheetName(wb, ['ガス管', '配管', 'パイプ']);
  if (!pipeSheet) warnings.push(`シート見つからず: ガス管`);
  const pipes = (pipeSheet ? sheetToRows(wb, pipeSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      // 以前の表だと D が無い場合があるので、外径/D/Φ っぽい列を広めに拾う
      const D = num(pick(r, ['外径', 'D', 'd', 'φ', 'Φ']), NaN);
      const t = num(pick(r, ['板厚', 't', '厚み']), NaN);
      if (!Number.isFinite(D) || !Number.isFinite(t)) return null;

      return { name, D, t };
    })
    .filter(Boolean);

  // ===== 丸鋼 =====
  const rbSheet = findSheetName(wb, ['丸鋼', '丸棒', 'RB']);
  if (!rbSheet) warnings.push(`シート見つからず: 丸鋼`);
  const roundBars = (rbSheet ? sheetToRows(wb, rbSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;
      const D = num(pick(r, ['直径', '外径', 'D', 'd', 'φ', 'Φ']), NaN);
      if (!Number.isFinite(D)) return null;
      return { name, D };
    })
    .filter(Boolean);

  // ===== FB（フラットバー）=====
  const fbSheet = findSheetName(wb, ['FB', 'フラットバー']);
  if (!fbSheet) warnings.push(`シート見つからず: FB`);
  const flatBars = (fbSheet ? sheetToRows(wb, fbSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const H = num(pick(r, ['H', '幅', 'W']), NaN);
      const t = num(pick(r, ['板厚', 't', '厚み']), NaN);
      if (!Number.isFinite(H) || !Number.isFinite(t)) return null;

      return { name, H, t };
    })
    .filter(Boolean);

  // ===== 角パイプ =====
  const sqSheet = findSheetName(wb, ['角パイプ', '角管', '角']);
  if (!sqSheet) warnings.push(`シート見つからず: 角パイプ`);
  const squarePipes = (sqSheet ? sheetToRows(wb, sqSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const H = num(pick(r, ['H', '高さ']), NaN);
      const B = num(pick(r, ['B', '幅', 'W']), NaN);
      const t = num(pick(r, ['板厚', 't', '厚み']), NaN);
      // 角丸（R/ｒ）列があるなら拾う（無ければ 0）
      const rr = num(pick(r, ['R', 'r', 'ｒ', '角R']), 0);

      if (!Number.isFinite(H) || !Number.isFinite(B) || !Number.isFinite(t)) return null;
      return { name, H, B, t, r: Number.isFinite(rr) ? rr : 0 };
    })
    .filter(Boolean);

  // ===== チャンネル =====
  const channelSheet = findSheetName(wb, ['チャンネル', 'チャンネル鋼', 'Cチャン', 'CHANNEL']);
  if (!channelSheet) warnings.push(`シート見つからず: チャンネル`);
  const channels = (channelSheet ? sheetToRows(wb, channelSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const H = num(pick(r, ['H']), NaN);
      const B = num(pick(r, ['B']), NaN);
      const t1 = num(pick(r, ['t1']), NaN);
      const t2 = num(pick(r, ['t2']), NaN);

      if (![H, B, t1, t2].every(Number.isFinite)) return null;

      return {
        name,
        H,
        B,
        t1,
        t2,
        r1: num(pick(r, ['r1', 'R1']), 0),
        r2: num(pick(r, ['r2', 'R2']), 0),
      };
    })
    .filter(Boolean);

  // ===== アングル（L）=====
  const angleSheet = findSheetName(wb, ['アングル', 'Lアングル', 'ANGLE']);
  if (!angleSheet) warnings.push(`シート見つからず: アングル`);
  const angles = (angleSheet ? sheetToRows(wb, angleSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const A = num(pick(r, ['A']), NaN);
      const B = num(pick(r, ['B']), NaN);
      const t = num(pick(r, ['t', '板厚', '厚み']), NaN);

      if (![A, B, t].every(Number.isFinite)) return null;

      return {
        name,
        A,
        B,
        t,
        r1: num(pick(r, ['r1', 'R1']), 0),
        r2: num(pick(r, ['r2', 'R2']), 0),
      };
    })
    .filter(Boolean);

  // ===== H鋼 =====
  const hSheet = findSheetName(wb, ['H鋼', 'Ｈ鋼', 'H', 'H形鋼', 'H-Beam']);
  if (!hSheet) warnings.push(`シート見つからず: H鋼`);
  const hBeams = (hSheet ? sheetToRows(wb, hSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const H = num(pick(r, ['H']), NaN);
      const B = num(pick(r, ['B']), NaN);
      const t1 = num(pick(r, ['t1']), NaN);
      const t2 = num(pick(r, ['t2']), NaN);
      const rr = num(pick(r, ['r', 'R', 'ｒ']), 0);

      if (![H, B, t1, t2].every(Number.isFinite)) return null;

      return { name, H, B, t1, t2, r: Number.isFinite(rr) ? rr : 0 };
    })
    .filter(Boolean);

  // ===== エキスパンド（見た目用。板厚列が無い想定なので持たない）=====
  const exSheet = findSheetName(wb, ['エキスパンド', 'エキスパンドメタル', 'EXPAND', 'Expanded']);
  if (!exSheet) warnings.push(`シート見つからず: エキスパンド`);
  const expands = (exSheet ? sheetToRows(wb, exSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const unitMass = num(pick(r, ['単位質量', '単位重量', '単重', 'kg/m2', 'kg/㎡']), NaN);
      const cost = num(pick(r, ['原価']), NaN);
      const price = num(pick(r, ['単価']), NaN);
      const cut = num(pick(r, ['切断費']), NaN);

      return {
        name,
        unitMass: Number.isFinite(unitMass) ? unitMass : null,
        cost: Number.isFinite(cost) ? cost : null,
        price: Number.isFinite(price) ? price : null,
        cut: Number.isFinite(cut) ? cut : null,
      };
    })
    .filter(Boolean);

  // ===== 縞板（板厚は持つ）=====
  const chkSheet = findSheetName(wb, ['縞板', 'しま板', 'チェッカー', 'CHECKER', 'Checker']);
  if (!chkSheet) warnings.push(`シート見つからず: 縞板`);
  const checkeredPlates = (chkSheet ? sheetToRows(wb, chkSheet) : [])
    .map((r) => {
      const name = String(pick(r, ['呼び名', '名称', 'name']) ?? '').trim();
      if (!name) return null;

      const t = num(pick(r, ['板厚', 't', '厚み']), NaN);
      const unitMass = num(pick(r, ['単位質量', '単位重量', '単重', 'kg/m2', 'kg/㎡']), NaN);
      const cost = num(pick(r, ['原価']), NaN);
      const price = num(pick(r, ['単価']), NaN);
      const cut = num(pick(r, ['切断費']), NaN);

      return {
        name,
        t: Number.isFinite(t) ? t : 3.2,
        unitMass: Number.isFinite(unitMass) ? unitMass : null,
        cost: Number.isFinite(cost) ? cost : null,
        price: Number.isFinite(price) ? price : null,
        cut: Number.isFinite(cut) ? cut : null,
      };
    })
    .filter(Boolean);

  // 何も取れないのは異常（Excelのヘッダ/シート名が違うなど）
  if (
    !channels.length &&
    !angles.length &&
    !pipes.length &&
    !roundBars.length &&
    !flatBars.length &&
    !squarePipes.length &&
    !hBeams.length &&
    !expands.length &&
    !checkeredPlates.length
  ) {
    throw new Error(`Excelは読めたがデータが全部空。\nシート一覧: ${sheetNames.join(', ')}`);
  }

  return {
    channels,
    angles,
    pipes,
    roundBars,
    flatBars,
    squarePipes,
    hBeams,
    expands,
    checkeredPlates,
    _meta: { ok: true, sourceUrl, sheetNames, warnings },
  };
}
