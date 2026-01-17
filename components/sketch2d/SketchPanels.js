// file: components/sketch2d/SketchPanels.js
'use client';

import { useMemo } from 'react';

const Btn = ({ active, disabled, onClick, children, title }) => (
  <button
    className={[
      'rounded border px-2 py-1 text-xs transition',
      'hover:bg-gray-50',
      active ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300' : 'bg-white',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
    ].join(' ')}
    type="button"
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      onClick?.();
    }}
    title={title}
  >
    {children}
  </button>
);

function isTypingLike(s) {
  // 途中入力（空/符号/小数点）は “未入力扱い” にしたい
  if (s == null) return true;
  const v = String(s);
  return v === '' || v === '-' || v === '+' || v === '.' || v === '-.' || v === '+.';
}

export function SketchToolPanel({
  step, // 'pickFace' | 'drawing'
  tool,
  setTool,
  onExit,
  onDeleteLast,
  entityCount,

  // ★追加：数値拘束（未入力なら自由）
  lineLen,
  setLineLen,
  lineAng,
  setLineAng,
}) {
  const disabled = step !== 'drawing';
  const lenEmpty = isTypingLike(lineLen);
  const angEmpty = isTypingLike(lineAng);

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="text-xs font-semibold">2D作図</div>

      {step === 'pickFace' ? (
        <div className="text-[11px] text-gray-600">
          1) 立体の <span className="font-semibold">面をクリック</span> して作図を開始します
        </div>
      ) : (
        <div className="text-[11px] text-gray-600">
          2) 面上に作図します（線/円は2クリックで確定。ESCで作りかけ解除）
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Btn active={tool === 'line'} onClick={() => setTool('line')} disabled={disabled} title="2クリックで線分">
          線
        </Btn>
        <Btn active={tool === 'circle'} onClick={() => setTool('circle')} disabled={disabled} title="中心→半径点で円">
          円
        </Btn>

        <Btn disabled title="準備中（次段で実装）">
          円弧
        </Btn>
        <Btn disabled title="準備中（次段で実装）">
          面取り
        </Btn>
        <Btn disabled title="準備中（次段で実装）">
          オフセット
        </Btn>
        <Btn disabled title="準備中（次段で実装）">
          トリム
        </Btn>

        <Btn
          onClick={onDeleteLast}
          disabled={step !== 'drawing' || entityCount <= 0}
          title="最後に追加した要素を削除"
        >
          削除
        </Btn>
      </div>

      {/* ★追加：線の長さ/角度（未入力なら自由作図） */}
      {tool === 'line' ? (
        <div className="rounded border p-2 bg-white space-y-2">
          <div className="text-[11px] text-gray-600 font-semibold">線：数値指定（任意）</div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-gray-500 mb-1">距離 L(mm)</div>
              <input
                className="w-full rounded border px-2 py-1 text-xs"
                type="text"
                inputMode="decimal"
                placeholder="（未入力＝自由）"
                value={lineLen ?? ''}
                disabled={step !== 'drawing'}
                onChange={(e) => {
                  const s = e.target.value;
                  if (!/^[+\-]?\d*(\.\d*)?$/.test(s)) return;
                  setLineLen?.(s);
                }}
              />
              <div className="text-[10px] text-gray-400 mt-1">
                {lenEmpty ? '自由距離' : '距離固定'}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 mb-1">角度 θ(°)</div>
              <input
                className="w-full rounded border px-2 py-1 text-xs"
                type="text"
                inputMode="decimal"
                placeholder="（未入力＝自由）"
                value={lineAng ?? ''}
                disabled={step !== 'drawing'}
                onChange={(e) => {
                  const s = e.target.value;
                  if (!/^[+\-]?\d*(\.\d*)?$/.test(s)) return;
                  setLineAng?.(s);
                }}
              />
              <div className="text-[10px] text-gray-400 mt-1">
                {angEmpty ? '自由角度（0/90付近は表示＆スナップ）' : '角度固定'}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
              type="button"
              disabled={step !== 'drawing'}
              onClick={() => {
                setLineLen?.('');
                setLineAng?.('');
              }}
              title="距離/角度を未入力に戻す（自由作図）"
            >
              自由作図に戻す
            </button>

            <button
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              type="button"
              disabled={step !== 'drawing'}
              onClick={() => setLineAng?.('0')}
              title="角度を0°にする"
            >
              0°
            </button>
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              type="button"
              disabled={step !== 'drawing'}
              onClick={() => setLineAng?.('90')}
              title="角度を90°にする"
            >
              90°
            </button>
          </div>

          <div className="text-[10px] text-gray-500">
            ※角度はスケッチ面のU軸（+X方向）基準の度数（反時計回り）
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={onExit}>
          終了
        </button>
      </div>
    </div>
  );
}

export function ExtrudePanel({
  step, // 'pickFace' | 'pickRegion'
  loops = [],
  selectedLoopId,
  setSelectedLoopId,
  length,
  setLength,
  onDoExtrude,
  onExit,
}) {
  const hasLoops = loops.length > 0;

  const selected = useMemo(() => loops.find((l) => l.id === selectedLoopId) ?? null, [loops, selectedLoopId]);

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="text-xs font-semibold">立体化（押出し）</div>

      {step === 'pickFace' ? (
        <div className="text-[11px] text-gray-600">
          1) 押出ししたい <span className="font-semibold">面をクリック</span>（その面の2D作図から輪郭を探します）
        </div>
      ) : (
        <div className="text-[11px] text-gray-600">
          2) ループを選択（ハッチング表示）→ 押出し長さを入力 → 実行
        </div>
      )}

      {step !== 'pickFace' ? (
        <>
          <div className="text-[11px] text-gray-500">輪郭（閉ループ）</div>
          <div className="space-y-1">
            {hasLoops ? (
              loops.map((l, i) => (
                <button
                  key={l.id}
                  className={[
                    'w-full text-left rounded border px-2 py-1 text-xs hover:bg-gray-50',
                    selectedLoopId === l.id ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : '',
                  ].join(' ')}
                  type="button"
                  onClick={() => setSelectedLoopId(l.id)}
                >
                  ループ {i + 1}（点 {l.points.length}）
                </button>
              ))
            ) : (
              <div className="text-[11px] text-red-600">この面に “閉じた線ループ” が見つかりません（線で囲ってください）</div>
            )}
          </div>

          <div>
            <div className="text-[10px] text-gray-500 mb-1">押出し長さ（mm）</div>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              type="number"
              step="1"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            />
          </div>

          <button
            className={`w-full rounded border px-2 py-1 text-xs hover:bg-gray-50 ${!selected ? 'opacity-40 cursor-not-allowed' : ''}`}
            type="button"
            onClick={() => {
              if (!selected) return;
              onDoExtrude?.();
            }}
          >
            押出し実行
          </button>
        </>
      ) : null}

      <div className="flex gap-2">
        <button className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={onExit}>
          終了
        </button>
      </div>
    </div>
  );
}
