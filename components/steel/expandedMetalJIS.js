// file: components/steel/expandedMetalJIS.js
'use client';

/**
 * エキスパンドメタル（JISタイプ）抜粋
 * name: 規格呼称
 * SW: 短目中心距離(mm)
 * LW: 長目中心距離(mm)
 * T : 板厚(mm)
 * W : ストランド幅(mm)
 *
 * 寸法の元ネタ：JIS G 3351 系の規格表（公開表） :contentReference[oaicite:1]{index=1}
 */
export const EXPANDED_LIST = [
  // Gタイプ（グレーティング系）
  { name: 'XG21', SW: 36.0, LW: 101.6, T: 4.5, W: 7.0 },
  { name: 'XG22', SW: 36.0, LW: 101.6, T: 6.0, W: 7.0 },

  // Sタイプ（スタンダード）
  { name: 'XS32', SW: 12.0, LW: 30.5, T: 1.6, W: 2.0 },
  { name: 'XS33', SW: 12.0, LW: 30.5, T: 2.3, W: 3.0 },

  { name: 'XS43', SW: 22.0, LW: 50.8, T: 3.2, W: 3.5 },
  { name: 'XS63', SW: 34.0, LW: 76.2, T: 4.5, W: 5.0 },
];

export function getExpandedSpec(name) {
  const s = String(name ?? '').trim();
  return EXPANDED_LIST.find((x) => x.name === s) ?? null;
}
