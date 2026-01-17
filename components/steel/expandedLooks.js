// file: components/steel/expandedLooks.js
'use client';

/**
 * 見た目だけエキスパンド用プリセット
 * - XG: 粗め（穴大きい）
 * - XS: 細め（穴小さい）
 * ※ 実寸規格ではなく「見た目用」なので自由に調整OK
 */
export function getExpandedLookPreset(name) {
  const s = String(name ?? '').trim().toUpperCase();

  // デフォ（XS寄り）
  let SW = 12;   // 短目ピッチ
  let LW = 30;   // 長目ピッチ
  let T = 2.3;   // 板厚（見た目用、重量はExcel側を使う前提）
  let W = 2.6;   // ストランド幅（穴を狭める）

  if (s.startsWith('XG')) {
    // 粗め（穴大きい）
    SW = 36;
    LW = 100;
    T = 4.5;
    W = 7.0;
  } else if (s.startsWith('XS')) {
    // 細め（穴小さい）
    SW = 12;
    LW = 30;
    // 番号で少し変える（見た目だけ）
    if (s.includes('63')) {
      SW = 34;
      LW = 76;
      T = 4.5;
      W = 5.0;
    } else if (s.includes('43')) {
      SW = 22;
      LW = 50;
      T = 3.2;
      W = 3.5;
    } else if (s.includes('33')) {
      SW = 12;
      LW = 30;
      T = 2.3;
      W = 3.0;
    } else if (s.includes('32')) {
      SW = 12;
      LW = 30;
      T = 1.6;
      W = 2.0;
    }
  }

  return { SW, LW, T, W };
}
