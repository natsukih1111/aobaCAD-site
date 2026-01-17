// file: lib/cutting/solvePlateCutting.js

export const PLATE_STOCKS = [
  { name: '3x6', w: 914, h: 1829 },
  { name: '4x8', w: 1219, h: 2438 },
  { name: '5x10', w: 1524, h: 3048 },
];

function calcOne(stockW, stockH, partW, partH) {
  const nx = Math.floor(stockW / partW);
  const ny = Math.floor(stockH / partH);
  return nx * ny;
}

export function solvePlateCutting({ width, height, qty, ignoreDirection }) {
  const results = [];

  for (const stock of PLATE_STOCKS) {
    const normal = calcOne(stock.w, stock.h, width, height);
    const rotated = calcOne(stock.w, stock.h, height, width);

    let best = normal;
    let direction = '縦';

    if (rotated > best) {
      best = rotated;
      direction = '横';
    }

    if (ignoreDirection) {
      best = Math.max(normal, rotated);
      direction = '自由';
    }

    if (best === 0) continue;

    const need = Math.ceil(qty / best);

    results.push({
      stock: stock.name,
      stockSize: `${stock.w}×${stock.h}`,
      perSheet: best,
      needSheets: need,
      direction,
    });
  }

  results.sort((a, b) => a.needSheets - b.needSheets);

  return results;
}
