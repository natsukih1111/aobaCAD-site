// file: components/cutting/SheetLayoutDiagram.js
'use client';

export default function SheetLayoutDiagram({
  stockW,
  stockH,
  nx,
  ny,
  partW,
  partH,
  showDims = true,
  showPartDims = true,

  // ★エキスパンド用（nullなら普通の鉄板）
  meshEnabled = false,
  // 'tatami' | 'soroban'
  meshKind = 'tatami',
}) {
  const W0 = Math.max(1, Number(stockW || 1));
  const H0 = Math.max(1, Number(stockH || 1));

  const nx0 = Math.max(0, Number(nx || 0));
  const ny0 = Math.max(0, Number(ny || 0));

  const pw0 = Math.max(0, Number(partW || 0));
  const ph0 = Math.max(0, Number(partH || 0));

  // ✅ 見やすさ優先：縦長シートは「表示だけ」横向きにする
  const landscape = H0 > W0;

  const W = landscape ? H0 : W0;
  const H = landscape ? W0 : H0;

  const nX = landscape ? ny0 : nx0;
  const nY = landscape ? nx0 : ny0;

  const pW = landscape ? ph0 : pw0;
  const pH = landscape ? pw0 : ph0;

  // ✅ 横長固定（印刷向き）
  const svgW = 980;
  const svgH = 420;

  // ✅ 寸法用余白（大きく）
  const pad = showDims ? 140 : 28;
  const vbW = W + pad * 2;
  const vbH = H + pad * 2;

  const ox = pad;
  const oy = pad;

  const dimGap = 70;
  const arrow = 14;

  // ✅ 寸法文字
  const FONT_DIM = 46;
  const FONT_INFO = 32;

  // ✅ マス内の文字は「小さく」＋上限
  const partFont = (() => {
    if (!showDims || !showPartDims) return 0;
    if (pw0 <= 0 || ph0 <= 0) return 0;
    const base = Math.min(pW, pH);
    const fs = Math.floor(base / 7); // 以前より小さめ
    return Math.max(18, Math.min(34, fs)); // ★ここが重要：デカすぎない上限
  })();

  // --- 寸法線（横） ---
  function DimLineX({ x1, x2, y, label }) {
    return (
      <>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="black" strokeWidth="4" />
        <line x1={x1} y1={y} x2={x1 + arrow} y2={y - arrow} stroke="black" strokeWidth="4" />
        <line x1={x1} y1={y} x2={x1 + arrow} y2={y + arrow} stroke="black" strokeWidth="4" />
        <line x1={x2} y1={y} x2={x2 - arrow} y2={y - arrow} stroke="black" strokeWidth="4" />
        <line x1={x2} y1={y} x2={x2 - arrow} y2={y + arrow} stroke="black" strokeWidth="4" />

        <text
          x={(x1 + x2) / 2}
          y={y - 18}
          fontSize={FONT_DIM}
          textAnchor="middle"
          fontWeight="900"
          fill="black"
        >
          {label}
        </text>
      </>
    );
  }

  // --- 寸法線（縦）※文字を90度回転して「矢印の上」に載せる ---
  function DimLineY({ x, y1, y2, label }) {
    const midY = (y1 + y2) / 2;
    // 文字を線の上に載せるため、少し左へ
    const textX = x - 26;

    return (
      <>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth="4" />
        <line x1={x} y1={y1} x2={x - arrow} y2={y1 + arrow} stroke="black" strokeWidth="4" />
        <line x1={x} y1={y1} x2={x + arrow} y2={y1 + arrow} stroke="black" strokeWidth="4" />
        <line x1={x} y1={y2} x2={x - arrow} y2={y2 - arrow} stroke="black" strokeWidth="4" />
        <line x1={x} y1={y2} x2={x + arrow} y2={y2 - arrow} stroke="black" strokeWidth="4" />

        {/* ★90度回転（あなたの2枚目の書き方） */}
        <text
          x={textX}
          y={midY}
          fontSize={FONT_DIM}
          textAnchor="middle"
          fontWeight="900"
          fill="black"
          transform={`rotate(-90 ${textX} ${midY})`}
        >
          {label}
        </text>
      </>
    );
  }

  // --- エキスパンド網目（ダイヤ）パターン ---
  // ※厳密な製品網目形状ではなく、「方向が分かる」図示用
  const PAT_W = 140;
  const PAT_H = 80;

  // ダイヤ1個
  const diamondPath = `
    M ${PAT_W * 0.25} ${PAT_H * 0.5}
    L ${PAT_W * 0.5} ${PAT_H * 0.2}
    L ${PAT_W * 0.75} ${PAT_H * 0.5}
    L ${PAT_W * 0.5} ${PAT_H * 0.8}
    Z
  `;

  // たたみ目：横方向に流れる（広がり感を横）
  // そろばん目：縦方向に流れる（たたみ目を90度回転）
  const patTransform = meshKind === 'soroban' ? `rotate(90)` : '';

  const clipId = `clip_sheet_${W0}_${H0}_${meshKind}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="bg-white"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={ox} y={oy} width={W} height={H} />
          </clipPath>

          {/* ★網目パターン */}
          <pattern
            id="expanded_mesh_pat"
            patternUnits="userSpaceOnUse"
            width={PAT_W}
            height={PAT_H}
            patternTransform={patTransform}
          >
            {/* 1個目 */}
            <path d={diamondPath} fill="none" stroke="black" strokeWidth="2" opacity="0.45" />
            {/* 横にもう1個（連続感） */}
            <g transform={`translate(${PAT_W * 0.5},0)`}>
              <path d={diamondPath} fill="none" stroke="black" strokeWidth="2" opacity="0.45" />
            </g>
            {/* 下段 */}
            <g transform={`translate(${PAT_W * 0.25},${PAT_H * 0.5})`}>
              <path d={diamondPath} fill="none" stroke="black" strokeWidth="2" opacity="0.45" />
            </g>
          </pattern>
        </defs>

        {/* ✅ シート枠 */}
        <rect
          x={ox}
          y={oy}
          width={W}
          height={H}
          fill="none"
          stroke="black"
          strokeWidth="5"
        />

        {/* ✅ エキスパンドの網目を描画 */}
        {meshEnabled && (
          <g clipPath={`url(#${clipId})`}>
            <rect
              x={ox}
              y={oy}
              width={W}
              height={H}
              fill="url(#expanded_mesh_pat)"
              opacity="0.9"
            />
          </g>
        )}

        {/* ✅ パーツ配置 */}
        {Array.from({ length: nY }).map((_, yy) =>
          Array.from({ length: nX }).map((__, xx) => {
            const x = ox + xx * pW;
            const y = oy + yy * pH;

            return (
              <g key={`${xx}-${yy}`}>
                <rect
                  x={x}
                  y={y}
                  width={pW}
                  height={pH}
                  fill="none"
                  stroke="black"
                  strokeWidth="2.6"
                />

                {/* ✅ 必要寸法をマス内に（小さめ） */}
                {showDims && showPartDims && partFont > 0 && (
                  <text
                    x={x + pW / 2}
                    y={y + pH / 2}
                    fontSize={partFont}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="800"
                    fill="black"
                    opacity="0.7"
                  >
                    {pw0}×{ph0}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ✅ 寸法（シート外形） */}
        {showDims && (
          <>
            {/* 横寸法 */}
            <DimLineX
              x1={ox}
              x2={ox + W}
              y={oy - dimGap}
              label={`${Math.max(W0, H0)} mm`}
            />

            {/* 縦寸法（回転表示） */}
            <DimLineY
              x={ox - dimGap}
              y1={oy}
              y2={oy + H}
              label={`${Math.min(W0, H0)} mm`}
            />

            {/* 下の情報 */}
            {pw0 > 0 && ph0 > 0 && (
              <text x={ox} y={oy + H + 74} fontSize={FONT_INFO} fontWeight="900" fill="black">
                部品：{pw0}×{ph0} mm　配置：{nx0}×{ny0}　最大：{nx0 * ny0}枚
              </text>
            )}

            {/* エキスパンドの方向表記（たたみ/そろばんが図で分かるように） */}
            {meshEnabled && (
              <text
                x={ox}
                y={oy - dimGap - 20}
                fontSize="26"
                fontWeight="900"
                fill="black"
              >
                エキスパンド：{meshKind === 'soroban' ? 'そろばん目' : 'たたみ目'}
              </text>
            )}

            {landscape && (
              <text x={ox} y={oy + H + 112} fontSize="22" fontWeight="700" fill="black" opacity="0.8">
                ※表示は見やすさのため横向きにしています（図だけ）
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
