// file: lib/cutting/solveCutting.js

function normalizeRows(rows) {
  return (rows || [])
    .map((r) => ({ length: Math.round(Number(r.length)), qty: Math.round(Number(r.qty)) }))
    .filter((r) => Number.isFinite(r.length) && Number.isFinite(r.qty) && r.length > 0 && r.qty > 0);
}

function normalizeList(list) {
  return (list || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n));
}

function expandRemnants(remnantRows) {
  const list = [];
  for (const r of remnantRows || []) {
    const len = Number(r.length);
    const qty = Number(r.qty);
    if (!Number.isFinite(len) || !Number.isFinite(qty)) continue;
    if (len <= 0 || qty <= 0) continue;
    for (let i = 0; i < qty; i++) list.push(Math.round(len));
  }
  list.sort((a, b) => b - a);
  return list;
}

// counts: Map(len -> qty)
function buildCounts(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.length, (m.get(r.length) || 0) + r.qty);
  }
  return m;
}

function countsToSortedLengthsDesc(counts) {
  return Array.from(counts.keys()).sort((a, b) => b - a);
}

function totalPiecesCount(counts) {
  let s = 0;
  for (const v of counts.values()) s += v;
  return s;
}

// 1ピースごとに +kerf 消費（安全側）
function canFitPiece(remain, pieceLen, kerf) {
  const need = pieceLen + (kerf > 0 ? kerf : 0);
  return need <= remain;
}

// 既存（歩留まり優先）1本詰め
function fillOneBarGreedyFromArray(stockLen, piecesDesc, kerf) {
  let remain = stockLen;
  const pickedIdx = [];
  const cuts = [];
  let kerfTotal = 0;

  for (let i = 0; i < piecesDesc.length; i++) {
    const p = piecesDesc[i];
    if (canFitPiece(remain, p, kerf)) {
      cuts.push(p);
      pickedIdx.push(i);
      remain -= p;
      if (kerf > 0) {
        remain -= kerf;
        kerfTotal += kerf;
      }
      if (remain <= 0) break;
    }
  }

  return { stockLen, cuts, remain, kerfTotal, pickedIdx };
}

function removePicked(piecesDesc, pickedIdx) {
  if (pickedIdx.length === 0) return piecesDesc;
  const set = new Set(pickedIdx);
  const next = [];
  for (let i = 0; i < piecesDesc.length; i++) if (!set.has(i)) next.push(piecesDesc[i]);
  return next;
}

function expandPieces(rows) {
  const pieces = [];
  for (const r of rows) {
    for (let i = 0; i < r.qty; i++) pieces.push(r.length);
  }
  pieces.sort((a, b) => b - a);
  return pieces;
}

// --------------------
// 重ね切りモード（パターン反復）
// --------------------
function buildPatternGreedyFromCounts(stockLen, counts, kerf) {
  const lengths = countsToSortedLengthsDesc(counts);
  let remain = stockLen;
  const cuts = [];
  const patternNeed = new Map(); // len -> how many in pattern
  let kerfTotal = 0;

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const len of lengths) {
      const qty = counts.get(len) || 0;
      if (qty <= 0) continue;
      if (!canFitPiece(remain, len, kerf)) continue;

      cuts.push(len);
      patternNeed.set(len, (patternNeed.get(len) || 0) + 1);

      remain -= len;
      if (kerf > 0) {
        remain -= kerf;
        kerfTotal += kerf;
      }

      progressed = true;
      if (remain <= 0) break;
    }
  }

  return { cuts, patternNeed, remain, kerfTotal };
}

function maxRepeatCount(counts, patternNeed) {
  let k = Infinity;
  for (const [len, need] of patternNeed.entries()) {
    const have = counts.get(len) || 0;
    k = Math.min(k, Math.floor(have / need));
  }
  if (k === Infinity) k = 0;
  return k;
}

function subtractPattern(counts, patternNeed, times) {
  for (const [len, need] of patternNeed.entries()) {
    const have = counts.get(len) || 0;
    counts.set(len, have - need * times);
  }
  for (const [len, qty] of counts.entries()) {
    if (qty <= 0) counts.delete(len);
  }
}

function solveStacking({ stockLengths, rows, options }) {
  const kerfMm = Number(options?.kerfMm || 0);
  const kerf = Number.isFinite(kerfMm) && kerfMm > 0 ? Math.round(kerfMm) : 0;

  const stock = normalizeList(stockLengths).sort((a, b) => a - b);
  const cleanedRows = normalizeRows(rows);

  if (cleanedRows.length === 0) {
    return { ok: false, error: '必要な長さ/本数を入力してください。', bars: [], summary: null };
  }
  if (stock.length === 0) {
    return { ok: false, error: '定尺が0件です（追加してください）。', bars: [], summary: null };
  }

  const remnants = expandRemnants(options?.remnants || []);
  const maxStock = stock[stock.length - 1] || 0;
  const maxRem = remnants[0] || 0;
  const maxAvail = Math.max(maxStock, maxRem);

  const maxPiece = Math.max(...cleanedRows.map((r) => r.length));
  if (maxPiece + kerf > maxAvail) {
    return {
      ok: false,
      error: `最大ピース ${maxPiece}mm に切断しろ${kerf}mm を足すと ${maxPiece + kerf}mm。最大材料 ${maxAvail}mm に入りません。`,
      bars: [],
      summary: null,
    };
  }

  let counts = buildCounts(cleanedRows);
  const bars = [];
  const usedRemnants = [];

  if (remnants.length > 0) {
    let pieces = [];
    for (const [len, qty] of counts.entries()) for (let i = 0; i < qty; i++) pieces.push(len);
    pieces.sort((a, b) => b - a);

    for (let i = 0; i < remnants.length && pieces.length > 0; i++) {
      const remLen = remnants[i];
      const trial = fillOneBarGreedyFromArray(remLen, pieces, kerf);
      if (trial.cuts.length === 0) continue;

      bars.push({
        stockLen: remLen,
        cuts: trial.cuts,
        remain: trial.remain,
        kerfTotal: trial.kerfTotal,
        source: 'remnant',
        repeat: 1,
      });
      usedRemnants.push(remLen);

      pieces = removePicked(pieces, trial.pickedIdx);
    }

    counts = new Map();
    for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);
  }

  const fixedStockLen = stock[stock.length - 1];

  while (totalPiecesCount(counts) > 0) {
    const { cuts, patternNeed, remain, kerfTotal } = buildPatternGreedyFromCounts(
      fixedStockLen,
      counts,
      kerf
    );

    if (cuts.length === 0) {
      const lensDesc = countsToSortedLengthsDesc(counts);
      const largest = lensDesc[0];
      const candidate = stock.find((s) => s >= largest + kerf);
      if (!candidate) {
        return { ok: false, error: '材料が足りません（入る定尺がありません）。', bars: [], summary: null };
      }

      const tmpCounts = new Map(counts);
      const alt = buildPatternGreedyFromCounts(candidate, tmpCounts, kerf);
      if (alt.cuts.length === 0) {
        return { ok: false, error: '詰め込みに失敗しました（入力を確認してください）。', bars: [], summary: null };
      }

      subtractPattern(counts, alt.patternNeed, 1);
      bars.push({
        stockLen: candidate,
        cuts: alt.cuts,
        remain: alt.remain,
        kerfTotal: alt.kerfTotal,
        source: 'stock',
        repeat: 1,
      });
      continue;
    }

    let k = maxRepeatCount(counts, patternNeed);
    if (k <= 0) k = 1;

    subtractPattern(counts, patternNeed, k);
    bars.push({
      stockLen: fixedStockLen,
      cuts,
      remain,
      kerfTotal,
      source: 'stock',
      repeat: k,
    });
  }

  const byPurchasedStock = {};
  let purchasedBarsCount = 0;

  let totalStockAll = 0;
  let totalUsedAll = 0;
  let totalRemainAll = 0;
  let totalKerfAll = 0;

  for (const bar of bars) {
    const rep = bar.repeat || 1;

    totalStockAll += bar.stockLen * rep;
    const usedPer = bar.stockLen - bar.remain;
    totalUsedAll += usedPer * rep;
    totalRemainAll += bar.remain * rep;
    totalKerfAll += (bar.kerfTotal || 0) * rep;

    if (bar.source === 'stock') {
      purchasedBarsCount += rep;
      byPurchasedStock[bar.stockLen] = (byPurchasedStock[bar.stockLen] || 0) + rep;
    }
  }

  return {
    ok: true,
    error: null,
    bars,
    summary: {
      kerfMm: kerf,
      stackingMode: true,
      optimizeMode: 'stacking',
      purchasedBarsCount,
      byPurchasedStock,
      usedRemnantsCount: usedRemnants.length,
      usedRemnants,
      totalStockAll,
      totalUsedAll,
      totalRemainAll,
      totalKerfAll,
      yieldPct: totalStockAll > 0 ? (totalUsedAll / totalStockAll) * 100 : 0,
    },
  };
}

// --------------------
// ★追加：総端材最小（グローバル寄り）
// --------------------
function applyOneBar(stockLen, piecesDesc, kerf) {
  const trial = fillOneBarGreedyFromArray(stockLen, piecesDesc, kerf);
  if (!trial || trial.cuts.length === 0) return null;
  const nextPieces = removePicked(piecesDesc, trial.pickedIdx);
  return { trial, nextPieces };
}

// 残りを「最小で入る定尺」に貪欲詰めして総材料長を見積り
function greedyEstimateTotalStock(stockListAsc, piecesDesc, kerf) {
  let pieces = piecesDesc.slice();
  let total = 0;

  while (pieces.length > 0) {
    const largest = pieces[0];
    const candidate = stockListAsc.find((s) => s >= largest + kerf);
    if (!candidate) return Infinity;

    const res = applyOneBar(candidate, pieces, kerf);
    if (!res) return Infinity;

    total += candidate;
    pieces = res.nextPieces;
  }
  return total;
}

function pickBestBarByGlobalWaste({ candidates, stockListAsc, piecesDesc, kerf }) {
  let best = null;

  for (const c of candidates) {
    const res = applyOneBar(c.len, piecesDesc, kerf);
    if (!res) continue;

    // 端材は「総材料長」に入れない（在庫だから）
    const firstCost = c.source === 'remnant' ? 0 : c.len;

    const est = firstCost + greedyEstimateTotalStock(stockListAsc, res.nextPieces, kerf);

    // score（大きい方が良い）
    // ①推定購入総材料長が最小 ②この1本の端材小 ③カット数多 ④短い材料
    const score = [
      -est,
      -res.trial.remain,
      res.trial.cuts.length,
      -c.len,
      c.source === 'remnant' ? 1 : 0, // 同点なら端材を使う寄り
    ];

    if (!best) {
      best = { ...c, ...res.trial, score };
      continue;
    }

    let better = false;
    for (let i = 0; i < score.length; i++) {
      if (score[i] > best.score[i]) { better = true; break; }
      if (score[i] < best.score[i]) break;
    }
    if (better) best = { ...c, ...res.trial, score };
  }

  return best;
}

// --------------------
// 既存（歩留まり優先） or 総端材最小
// --------------------
function solveYield({ stockLengths, rows, options }) {
  const kerfMm = Number(options?.kerfMm || 0);
  const kerf = Number.isFinite(kerfMm) && kerfMm > 0 ? Math.round(kerfMm) : 0;

  const stock = normalizeList(stockLengths).sort((a, b) => a - b);
  const cleanedRows = normalizeRows(rows);

  if (cleanedRows.length === 0) {
    return { ok: false, error: '必要な長さ/本数を入力してください。', bars: [], summary: null };
  }
  if (stock.length === 0) {
    return { ok: false, error: '定尺が0件です（追加してください）。', bars: [], summary: null };
  }

  // ★切替：'global' | 'greedy'
  const optimizeMode = (options?.optimizeMode || 'global') === 'greedy' ? 'greedy' : 'global';

  let pieces = expandPieces(cleanedRows);
  const remnants = expandRemnants(options?.remnants || []);

  const maxStock = stock[stock.length - 1] || 0;
  const maxRem = remnants[0] || 0;
  const maxAvail = Math.max(maxStock, maxRem);

  const tooLong = pieces.find((p) => p + kerf > maxAvail);
  if (tooLong) {
    return {
      ok: false,
      error: `入力に ${tooLong}mm があり、切断しろ${kerf}mm考慮だと必要長は ${tooLong + kerf}mm。最大の材料（定尺/端材）が ${maxAvail}mm なので入りません。`,
      bars: [],
      summary: null,
    };
  }

  const bars = [];
  const usedRemnants = [];

  while (pieces.length > 0) {
    const largest = pieces[0];

    const remCandidates = remnants.filter((r) => r >= largest + kerf);
    const stockCandidates = stock.filter((s) => s >= largest + kerf);

    const candidates = [
      ...remCandidates.map((len) => ({ len, source: 'remnant' })),
      ...stockCandidates.map((len) => ({ len, source: 'stock' })),
    ];

    if (candidates.length === 0) {
      return { ok: false, error: `材料が足りません（${largest}mm が入る材料がありません）。`, bars: [], summary: null };
    }

    let best = null;

    if (optimizeMode === 'global') {
      best = pickBestBarByGlobalWaste({
        candidates,
        stockListAsc: stock,
        piecesDesc: pieces,
        kerf,
      });
    } else {
      // 旧：一本ずつ端材最小（貪欲）
      for (const c of candidates) {
        const trial = fillOneBarGreedyFromArray(c.len, pieces, kerf);

        const score = [
          c.source === 'remnant' ? 1 : 0,
          -trial.remain,
          trial.cuts.length,
          -c.len,
        ];

        if (!best) {
          best = { ...trial, source: c.source, score };
          continue;
        }

        const b = best.score;
        const t = score;
        let better = false;
        for (let i = 0; i < b.length; i++) {
          if (t[i] > b[i]) { better = true; break; }
          if (t[i] < b[i]) break;
        }
        if (better) best = { ...trial, source: c.source, score };
      }
    }

    if (!best || best.cuts.length === 0) {
      return { ok: false, error: '詰め込みに失敗しました（入力を確認してください）。', bars: [], summary: null };
    }

    if (best.source === 'remnant') {
      const idx = remnants.findIndex((x) => x === best.stockLen);
      if (idx >= 0) remnants.splice(idx, 1);
      usedRemnants.push(best.stockLen);
    }

    bars.push({
      stockLen: best.stockLen,
      cuts: best.cuts,
      remain: best.remain,
      kerfTotal: best.kerfTotal,
      source: best.source,
      repeat: 1,
    });

    pieces = removePicked(pieces, best.pickedIdx);
  }

  const byPurchasedStock = {};
  let purchasedBarsCount = 0;

  let totalStockAll = 0;
  let totalUsedAll = 0;
  let totalRemainAll = 0;
  let totalKerfAll = 0;

  for (const bar of bars) {
    totalStockAll += bar.stockLen;
    totalUsedAll += bar.stockLen - bar.remain;
    totalRemainAll += bar.remain;
    totalKerfAll += bar.kerfTotal || 0;

    if (bar.source === 'stock') {
      purchasedBarsCount += 1;
      byPurchasedStock[bar.stockLen] = (byPurchasedStock[bar.stockLen] || 0) + 1;
    }
  }

  return {
    ok: true,
    error: null,
    bars,
    summary: {
      kerfMm: kerf,
      stackingMode: false,
      optimizeMode, // ★追加
      purchasedBarsCount,
      byPurchasedStock,
      usedRemnantsCount: usedRemnants.length,
      usedRemnants,
      totalStockAll,
      totalUsedAll,
      totalRemainAll,
      totalKerfAll,
      yieldPct: totalStockAll > 0 ? (totalUsedAll / totalStockAll) * 100 : 0,
    },
  };
}

// エントリ
export function solveCutting({ stockLengths, rows, options }) {
  const stackingMode = !!options?.stackingMode;
  if (stackingMode) {
    return solveStacking({ stockLengths, rows, options });
  }
  return solveYield({ stockLengths, rows, options });
}
