// file: components/steel/elbowLongJIS.js
'use client';

/**
 * JIS ロングエルボ（45°H / 90°F）
 * 外径D(mm) → { H, F }
 *
 * 出典：JIS系の寸法表（MISUMI掲載PDFなど） :contentReference[oaicite:1]{index=1}
 * ※ あなたのガス管外径（21.7/27.2/34/42.7/...）に合わせて入れてある
 */
const TABLE = [
  { D: 21.7, H: 15.8, F: 38.1 },
  { D: 27.2, H: 15.8, F: 38.1 },
  { D: 34.0, H: 15.8, F: 38.1 },
  { D: 42.7, H: 19.7, F: 47.6 },
  { D: 48.6, H: 23.7, F: 57.2 },
  { D: 60.5, H: 31.6, F: 76.2 },
  { D: 76.3, H: 39.5, F: 95.3 },
  { D: 89.1, H: 47.3, F: 114.3 },
  { D: 101.6, H: 55.3, F: 133.4 },
  { D: 114.3, H: 63.1, F: 152.4 },
  { D: 139.8, H: 78.9, F: 190.5 },
  { D: 165.2, H: 94.7, F: 228.6 },
  { D: 190.7, H: 110.5, F: 266.7 },
];

function near(a, b, eps = 0.25) {
  return Math.abs(a - b) <= eps;
}

export function getLongElbowDimsByOD(D) {
  const d = Number(D);
  if (!Number.isFinite(d)) return null;

  // まずは一致（小数誤差対策）
  const hit = TABLE.find((x) => near(x.D, d));
  if (hit) return { H: hit.H, F: hit.F };

  // 近いのを拾う（保険）
  let best = null;
  let bestDiff = Infinity;
  for (const x of TABLE) {
    const diff = Math.abs(x.D - d);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = x;
    }
  }
  if (!best) return null;
  return { H: best.H, F: best.F, _nearest: true, _diff: bestDiff };
}
