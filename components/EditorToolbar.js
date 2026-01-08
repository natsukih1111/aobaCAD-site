
'use client';

import { useEffect, useRef, useState } from 'react';

export default function EditorToolbar({
  currentTool,
  setTool,
  selectMode,
  setSelectMode,

  onAddCube,
  onAddBox,
  onAddCylinder,
  onAddCone,

  onDeleteSelected,
  canDelete,

  // 表示メニュー用
  onResetLayout,
  leftVisible,
  rightVisible,
  onToggleLeft,
  onToggleRight,

  // ✅ 追加：グループ/融合/分解
  onGroupSelected,
  onUngroupSelected,
  onFuseSelected,
  canGroup,
  canUngroup,
  canFuse,

  // ✅ 追加：影/グリッド
  showShadows,
  showGrid,
  onToggleShadows,
  onToggleGrid,

  // ✅ 追加：鋼材パネルを開く
  onOpenSteelPanel,
}) {
  const [openView, setOpenView] = useState(false);
  const [openDup, setOpenDup] = useState(false);

  const viewWrapRef = useRef(null);
  const dupWrapRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (openView && viewWrapRef.current && !viewWrapRef.current.contains(e.target)) {
        setOpenView(false);
      }
      if (openDup && dupWrapRef.current && !dupWrapRef.current.contains(e.target)) {
        setOpenDup(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [openView, openDup]);

  const Btn = ({ active, onClick, children, title, disabled }) => (
    <button
      className={`border px-2 py-1 text-xs hover:bg-gray-50 ${
        active ? 'bg-gray-200' : 'bg-white'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      title={title}
      type="button"
    >
      {children}
    </button>
  );

  const isDupTool =
    currentTool === 'dup-translate' || currentTool === 'dup-rotate' || currentTool === 'dup-mirror';

  return (
    <div className="w-full border-b bg-white">
      {/* 上段：メニュー */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs">
        {/* ✅ 左上のリンクは削除 */}

        <button className="border px-2 py-1 hover:bg-gray-50" type="button">
          ファイル
        </button>
        <button className="border px-2 py-1 hover:bg-gray-50" type="button">
          編集
        </button>

        {/* 表示：プルダウン */}
        <div className="relative" ref={viewWrapRef}>
          <button
            className="border px-2 py-1 hover:bg-gray-50"
            type="button"
            onClick={() => setOpenView((v) => !v)}
          >
            表示 ▾
          </button>

          {openView ? (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 border bg-white shadow">
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  onToggleLeft?.();
                  setOpenView(false);
                }}
              >
                {leftVisible ? '左パネルを非表示' : '左パネルを表示'}
              </button>
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  onToggleRight?.();
                  setOpenView(false);
                }}
              >
                {rightVisible ? '右パネルを非表示' : '右パネルを表示'}
              </button>

              <div className="my-1 border-t" />

              {/* ✅ 影/グリッド */}
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  onToggleShadows?.();
                }}
              >
                {showShadows ? '☑' : '☐'} 影（Shadow）
              </button>
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  onToggleGrid?.();
                }}
              >
                {showGrid ? '☑' : '☐'} グリッド線
              </button>

              <div className="my-1 border-t" />

              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  onResetLayout?.();
                  setOpenView(false);
                }}
              >
                幅を初期に戻す
              </button>
            </div>
          ) : null}
        </div>

        <button className="border px-2 py-1 hover:bg-gray-50" type="button">
          設定
        </button>
        <button className="border px-2 py-1 hover:bg-gray-50" type="button">
          ツール
        </button>
        <button className="border px-2 py-1 hover:bg-gray-50" type="button">
          ヘルプ
        </button>

        <div className="ml-auto text-xs text-gray-600">Tool: {currentTool}</div>
      </div>

      {/* 下段：ツールバー */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">
        <Btn active={currentTool === 'select'} onClick={() => setTool('select')}>
          選択
        </Btn>
        <Btn active={currentTool === 'pan'} onClick={() => setTool('pan')} title="複数をまとめて移動">
          平行移動
        </Btn>
        <Btn active={currentTool === 'rotate'} onClick={() => setTool('rotate')} title="軸と角度で回転">
          回転
        </Btn>

        {/* 複製（プルダウン） */}
        <div className="relative" ref={dupWrapRef}>
          <Btn active={isDupTool} onClick={() => setOpenDup((v) => !v)} title="複製（平行 / 回転 / ミラー）">
            複製 ▾
          </Btn>

          {openDup ? (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 border bg-white shadow">
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  setTool('dup-translate');
                  setOpenDup(false);
                }}
              >
                平行複製
              </button>
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  setTool('dup-rotate');
                  setOpenDup(false);
                }}
              >
                回転複製
              </button>
              <button
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                type="button"
                onClick={() => {
                  setTool('dup-mirror');
                  setOpenDup(false);
                }}
              >
                ミラー複製
              </button>
            </div>
          ) : null}
        </div>

        <span className="mx-1 text-xs text-gray-500">|</span>

        {/* ✅ 鋼材追加 */}
        <Btn onClick={() => onOpenSteelPanel?.()} title="鋼材（チャンネル / Lアングル）を追加">
          鋼材追加
        </Btn>

        <span className="mx-1 text-xs text-gray-500">|</span>

        {/* ✅ 作成は「サイズ指定してから」 */}
        <Btn onClick={onAddCube} title="サイズ指定してから配置（mm）">
          立方体
        </Btn>
        <Btn onClick={onAddBox} title="サイズ指定してから配置（mm）">
          直方体
        </Btn>
        <Btn onClick={onAddCylinder} title="サイズ指定してから配置（mm）">
          円柱
        </Btn>
        <Btn onClick={onAddCone} title="サイズ指定してから配置（mm）">
          円錐
        </Btn>

        <span className="mx-1 text-xs text-gray-500">|</span>

        <Btn
          active={selectMode === 'body'}
          onClick={() => setSelectMode?.('body')}
          title="立体そのものを選択"
        >
          立体モード
        </Btn>
        <Btn
          active={selectMode === 'vertex'}
          onClick={() => setSelectMode?.('vertex')}
          title="頂点/中点を表示して原点を設定"
        >
          頂点モード
        </Btn>

        <span className="mx-1 text-xs text-gray-500">|</span>

        {/* ✅ グループ/融合/分解 */}
        <Btn onClick={onGroupSelected} disabled={!canGroup} title="複数選択を1つのグループにまとめる">
          グループ化
        </Btn>
        <Btn onClick={onFuseSelected} disabled={!canFuse} title="選択物を1つの図形として融合（結合メッシュ）">
          融合
        </Btn>
        <Btn onClick={onUngroupSelected} disabled={!canUngroup} title="グループ化を解除（分解）">
          分解
        </Btn>

        <span className="mx-1 text-xs text-gray-500">|</span>

        <Btn onClick={() => onDeleteSelected?.()} title="Deleteキーでも削除" disabled={!canDelete}>
          削除
        </Btn>
      </div>
    </div>
  );
}
