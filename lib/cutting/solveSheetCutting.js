// file: lib/cutting/solveSheetCutting.js

function toInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function area(w, h) {
  return Math.max(0, w) * Math.max(0, h);
}

function normalizeParts(rows) {
  return (rows || [])
    .map((r) => ({
      w: toInt(r.w),
      h: toInt(r.h),
      qty: toInt(r.qty),
      label: String(r.label || '').trim(), // 任意
      // 任意：expanded用（行ごと）
      // 'tatami' | 'soroban' | null
      meshKind: r.meshKind ? String(r.meshKind) : null,
    }))
    .filter((r) => r.w > 0 && r.h > 0 && r.qty > 0);
}

function expandSheets(sheetRows) {
  const out = [];
  for (const r of sheetRows || []) {
    const w = toInt(r.w);
    const h = toInt(r.h);
    const qty = toInt(r.qty);
    if (w <= 0 || h <= 0 || qty <= 0) continue;
    for (let i = 0; i < qty; i++) out.push({ w, h });
  }
  out.sort((a, b) => area(b.w, b.h) - area(a.w, a.h));
  return out;
}

function totalNeed(parts) {
  let s = 0;
  for (const p of parts) s += p.qty;
  return s;
}

function cloneParts(parts) {
  return parts.map((p) => ({ ...p }));
}

// -------------------------
// 既存：1枚=1種類グリッド（混在OFF）
// -------------------------
function fitGrid(sheetW, sheetH, partW, partH) {
  const nx = Math.floor(sheetW / partW);
  const ny = Math.floor(sheetH / partH);
  return { nx, ny, count: Math.max(0, nx * ny) };
}

function bestFitForPart(sheet, part, options) {
  const ignoreDirection = !!options?.ignoreDirection;
  const forceDirection = options?.forceDirection || null; // 'A' | 'B' | null

  const A = fitGrid(sheet.w, sheet.h, part.w, part.h);
  const B = fitGrid(sheet.w, sheet.h, part.h, part.w);

  if (ignoreDirection) {
    if (B.count > A.count) return { dir: 'B', ...B, useW: part.h, useH: part.w };
    return { dir: 'A', ...A, useW: part.w, useH: part.h };
  }

  if (forceDirection === 'A') return { dir: 'A', ...A, useW: part.w, useH: part.h };
  if (forceDirection === 'B') return { dir: 'B', ...B, useW: part.h, useH: part.w };

  if (B.count > A.count) return { dir: 'B', ...B, useW: part.h, useH: part.w };
  return { dir: 'A', ...A, useW: part.w, useH: part.h };
}

function pickBestPlacementOneKind(sheet, parts, options) {
  let best = null;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const fit = bestFitForPart(sheet, p, options);
    if (fit.count <= 0) continue;

    const canMake = Math.min(p.qty, fit.count);
    if (canMake <= 0) continue;

    const usedArea = canMake * area(fit.useW, fit.useH);
    const partArea = area(fit.useW, fit.useH);

    const score = [canMake, usedArea, partArea];

    if (!best) {
      best = { idx: i, p, fit, canMake, score };
      continue;
    }

    let better = false;
    for (let k = 0; k < score.length; k++) {
      if (score[k] > best.score[k]) { better = true; break; }
      if (score[k] < best.score[k]) break;
    }
    if (better) best = { idx: i, p, fit, canMake, score };
  }

  return best;
}

// -------------------------
// 混在モード（A+Bを1枚に詰める）
// 1枚に棚詰め（shelf packing）
// -------------------------

function expandPieces(parts, options) {
  const pieces = [];
  for (const p of parts) {
    const label = p.label || `${p.w}×${p.h}`;
    for (let i = 0; i < p.qty; i++) {
      // エキスパンドの方向を「行ごと」に固定したい場合：
      // - ignoreDirection=true なら自由回転OK
      // - ignoreDirection=false のとき、meshKind により回転可否を縛る（暫定）
      //   tatami: A固定（w×h）
      //   soroban: B固定（h×w）
      let allow = 'both'; // 'A' | 'B' | 'both'
      if (!options?.ignoreDirection) {
        if (p.meshKind === 'tatami') allow = 'A';
        if (p.meshKind === 'soroban') allow = 'B';
      }

      pieces.push({
        w: p.w,
        h: p.h,
        label,
        allow,
      });
    }
  }
  // 面積大→小
  pieces.sort((a, b) => area(b.w, b.h) - area(a.w, a.h));
  return pieces;
}

function packOneSheetShelf(sheetW, sheetH, pieces, options) {
  const placed = [];
  const usedIdx = [];

  let x = 0;
  let y = 0;
  let shelfH = 0;

  function nextShelf() {
    if (y + shelfH >= sheetH) return false;
    y = y + shelfH;
    x = 0;
    shelfH = 0;
    return true;
  }

  function tryPlace(p, w, h, idx) {
    // 今棚
    if (x + w <= sheetW && y + h <= sheetH) {
      placed.push({ x, y, w, h, label: p.label });
      usedIdx.push(idx);
      x += w;
      shelfH = Math.max(shelfH, h);
      return true;
    }
    // 改棚
    if (!nextShelf()) return false;
    if (x + w <= sheetW && y + h <= sheetH) {
      placed.push({ x, y, w, h, label: p.label });
      usedIdx.push(idx);
      x += w;
      shelfH = Math.max(shelfH, h);
      return true;
    }
    return false;
  }

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];

    // global forceDirection（必要なら）
    const forceDirection = options?.forceDirection || null; // 'A' | 'B' | null
    const ignoreDirection = !!options?.ignoreDirection;

    const candidates = [];

    if (!ignoreDirection && forceDirection === 'A') {
      candidates.push(['A', p.w, p.h]);
    } else if (!ignoreDirection && forceDirection === 'B') {
      candidates.push(['B', p.h, p.w]);
    } else {
      // auto（ただし allow 制限あり）
      candidates.push(['A', p.w, p.h]);
      candidates.push(['B', p.h, p.w]);
    }

    let ok = false;
    for (const [dir, w, h] of candidates) {
      if (p.allow === 'A' && dir !== 'A') continue;
      if (p.allow === 'B' && dir !== 'B') continue;
      if (tryPlace(p, w, h, i)) { ok = true; break; }
    }
    // 置けないピースは次のシートへ回す（ここではスキップ）
    if (!ok) continue;
  }

  return { placed, usedIdx };
}

function removePickedPieces(pieces, usedIdx) {
  if (!usedIdx.length) return pieces;
  const set = new Set(usedIdx);
  const out = [];
  for (let i = 0; i < pieces.length; i++) if (!set.has(i)) out.push(pieces[i]);
  return out;
}

function partsSummaryFromPlaced(rects) {
  const m = new Map();
  for (const r of rects) {
    const key = r.label;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return Array.from(m.entries())
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty);
}

// -------------------------
// メイン
// -------------------------
export function solveSheetCutting({ stocks, rows, remnants, options }) {
  const stockList = (stocks || [])
    .map((s) => ({ id: String(s.id), name: String(s.name), w: toInt(s.w), h: toInt(s.h) }))
    .filter((s) => s.w > 0 && s.h > 0);

  const parts = normalizeParts(rows);
  const remList = expandSheets(remnants);

  if (parts.length === 0) {
    return { ok: false, error: '必要寸法（横・縦・枚数）を入力してください。', plan: null };
  }
  if (stockList.length === 0) {
    return { ok: false, error: '定尺が0件です（追加してください）。', plan: null };
  }

  const mixedMode = !!options?.mixedMode;

  // -------------------------
  // 混在OFF：従来（1枚=1種類）
  // -------------------------
  if (!mixedMode) {
    const work = cloneParts(parts).sort((a, b) => area(b.w, b.h) - area(a.w, a.h));

    const placements = [];
    const usedRemnants = [];
    const byPurchasedStock = {};

    // 端材
    for (const rem of remList) {
      if (totalNeed(work) <= 0) break;
      const best = pickBestPlacementOneKind(rem, work, options);
      if (!best) continue;
      work[best.idx].qty -= best.canMake;

      placements.push({
        source: 'remnant',
        sheet: { name: '端材', w: rem.w, h: rem.h, id: null },
        dir: best.fit.dir,
        nx: best.fit.nx,
        ny: best.fit.ny,
        partW: best.fit.useW,
        partH: best.fit.useH,
        made: best.canMake,

        // 混在じゃないので rects は空でOK
        rects: null,
        partsSummary: [{ label: `${best.p.w}×${best.p.h}`, qty: best.canMake }],
      });

      usedRemnants.push({ w: rem.w, h: rem.h });
    }

    // 購入
    while (totalNeed(work) > 0) {
      let bestChoice = null;

      for (const st of stockList) {
        const best = pickBestPlacementOneKind({ w: st.w, h: st.h }, work, options);
        if (!best) continue;

        const usedArea = best.canMake * area(best.fit.useW, best.fit.useH);
        const sheetArea = area(st.w, st.h);
        const score = [best.canMake, usedArea, -sheetArea];

        if (!bestChoice) { bestChoice = { st, best, score }; continue; }

        let better = false;
        for (let k = 0; k < score.length; k++) {
          if (score[k] > bestChoice.score[k]) { better = true; break; }
          if (score[k] < bestChoice.score[k]) break;
        }
        if (better) bestChoice = { st, best, score };
      }

      if (!bestChoice) {
        return { ok: false, error: 'どの定尺でも切り出せません（寸法が大きすぎます）。', plan: null };
      }

      const { st, best } = bestChoice;
      work[best.idx].qty -= best.canMake;
      byPurchasedStock[st.id] = (byPurchasedStock[st.id] || 0) + 1;

      placements.push({
        source: 'stock',
        sheet: { id: st.id, name: st.name, w: st.w, h: st.h },
        dir: best.fit.dir,
        nx: best.fit.nx,
        ny: best.fit.ny,
        partW: best.fit.useW,
        partH: best.fit.useH,
        made: best.canMake,

        rects: null,
        partsSummary: [{ label: `${best.p.w}×${best.p.h}`, qty: best.canMake }],
      });
    }

    const purchasedSheetsCount = Object.values(byPurchasedStock).reduce((a, b) => a + b, 0);
    const needTotal = parts.reduce((s, p) => s + p.qty, 0);
    const madeTotal = placements.reduce((s, pl) => s + (pl.made || 0), 0);

    return {
      ok: true,
      error: null,
      plan: {
        needTotal,
        madeTotal,
        usedRemnantsCount: usedRemnants.length,
        usedRemnants,
        purchasedSheetsCount,
        byPurchasedStock,
        placements,
        meta: {
          mixedMode: false,
          ignoreDirection: !!options?.ignoreDirection,
          forceDirection: options?.forceDirection || null,
        },
      },
    };
  }

  // -------------------------
  // 混在ON：棚詰めで1枚に複数種類を入れる
  // -------------------------
  let pieces = expandPieces(parts, options);

  const placements = [];
  const usedRemnants = [];
  const byPurchasedStock = {};

  // 端材を先に使う（大きい順）
  for (const rem of remList) {
    if (pieces.length === 0) break;

    const packed = packOneSheetShelf(rem.w, rem.h, pieces, options);
    if (!packed.usedIdx.length) continue;

    const rects = packed.placed;
    const summary = partsSummaryFromPlaced(rects);

    placements.push({
      source: 'remnant',
      sheet: { name: '端材', w: rem.w, h: rem.h, id: null },
      // 混在なので dir/nx/ny ではなく rects を使う
      dir: null,
      nx: null,
      ny: null,
      partW: null,
      partH: null,
      made: rects.length,
      rects,
      partsSummary: summary,
    });

    usedRemnants.push({ w: rem.w, h: rem.h });
    pieces = removePickedPieces(pieces, packed.usedIdx);
  }

  // 残りを購入定尺で埋める：その時点で「一番多く入る定尺」を選ぶ
  while (pieces.length > 0) {
    let best = null;

    for (const st of stockList) {
      const packed = packOneSheetShelf(st.w, st.h, pieces, options);
      const made = packed.usedIdx.length;
      if (made <= 0) continue;

      const usedA = packed.placed.reduce((s, r) => s + area(r.w, r.h), 0);
      const sheetA = area(st.w, st.h);

      // score: ①入る数 ②使用面積 ③小さい定尺優先
      const score = [made, usedA, -sheetA];

      if (!best) { best = { st, packed, score }; continue; }

      let better = false;
      for (let k = 0; k < score.length; k++) {
        if (score[k] > best.score[k]) { better = true; break; }
        if (score[k] < best.score[k]) break;
      }
      if (better) best = { st, packed, score };
    }

    if (!best) {
      return { ok: false, error: 'どの定尺でも切り出せません（寸法が大きすぎます）。', plan: null };
    }

    const rects = best.packed.placed;
    const summary = partsSummaryFromPlaced(rects);

    byPurchasedStock[best.st.id] = (byPurchasedStock[best.st.id] || 0) + 1;

    placements.push({
      source: 'stock',
      sheet: { id: best.st.id, name: best.st.name, w: best.st.w, h: best.st.h },
      dir: null,
      nx: null,
      ny: null,
      partW: null,
      partH: null,
      made: rects.length,
      rects,
      partsSummary: summary,
    });

    pieces = removePickedPieces(pieces, best.packed.usedIdx);
  }

  const purchasedSheetsCount = Object.values(byPurchasedStock).reduce((a, b) => a + b, 0);
  const needTotal = parts.reduce((s, p) => s + p.qty, 0);
  const madeTotal = placements.reduce((s, pl) => s + (pl.made || 0), 0);

  return {
    ok: true,
    error: null,
    plan: {
      needTotal,
      madeTotal,
      usedRemnantsCount: usedRemnants.length,
      usedRemnants,
      purchasedSheetsCount,
      byPurchasedStock,
      placements,
      meta: {
        mixedMode: true,
        ignoreDirection: !!options?.ignoreDirection,
        forceDirection: options?.forceDirection || null,
      },
    },
  };
}
