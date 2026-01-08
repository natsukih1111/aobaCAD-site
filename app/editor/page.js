
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EditorCanvas from '@/components/EditorCanvas';
import EditorToolbar from '@/components/EditorToolbar';
import { fetchSteelCatalog } from '@/components/steel/steelCatalog';

function uid() {
  return `obj_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function numLoose(v, fallback = 0) {
  // "-" や "" は fallback 扱い（入力途中は state で保持するのでOK）
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

const DEFAULT_LEFT = 260;
const DEFAULT_RIGHT = 260;

const LS_LEFT = 'cadsite_editor_left_w_v5';
const LS_RIGHT = 'cadsite_editor_right_w_v5';

const MM_BASE = 1000;

function SteelAddPanel({ catalog, draft, setDraft, onPlace, onCancel, disabled }) {
  if (!draft) return null;

  const kind = draft.kind ?? 'channel';
  const list = kind === 'channel' ? catalog.channels : catalog.angles;
  const length = draft.length ?? 6000;

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="text-xs font-semibold">鋼材追加（mm）</div>
      <div className="text-[11px] text-gray-500">Excelの規格から選んで長さを入力 →「配置」</div>

      <div className="flex gap-2">
        <button
          className={`flex-1 rounded border px-2 py-1 text-xs ${
            kind === 'channel'
              ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300'
              : 'bg-white hover:bg-gray-50'
          }`}
          type="button"
          onClick={() => {
            const first = catalog.channels?.[0];
            setDraft((d) => ({ ...d, kind: 'channel', name: first?.name ?? '', length }));
          }}
        >
          チャンネル
        </button>
        <button
          className={`flex-1 rounded border px-2 py-1 text-xs ${
            kind === 'angle'
              ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300'
              : 'bg-white hover:bg-gray-50'
          }`}
          type="button"
          onClick={() => {
            const first = catalog.angles?.[0];
            setDraft((d) => ({ ...d, kind: 'angle', name: first?.name ?? '', length }));
          }}
        >
          Lアングル
        </button>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">規格</div>
        <select
          className="w-full rounded border px-2 py-1 text-xs"
          value={draft.name ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          disabled={disabled}
        >
          <option value="">{list.length ? '選択してください' : '（データがありません）'}</option>
          {list.map((x) => (
            <option key={x.name} value={x.name}>
              {x.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">長さ L(mm)</div>
        <input
          className="w-full rounded border px-2 py-1 text-xs"
          type="number"
          step="1"
          value={length}
          onChange={(e) => setDraft((d) => ({ ...d, length: num(e.target.value, 6000) }))}
          disabled={disabled}
        />
      </div>

      <div className="flex gap-2">
        <button
          className={`flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
            disabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          type="button"
          onClick={() => {
            if (disabled) return;
            onPlace?.();
          }}
        >
          配置
        </button>
        <button className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>

      <div className="text-[11px] text-gray-500">※今は「外形サイズの箱」で仮配置（断面の本物形状は後で対応）</div>
    </div>
  );
}

export default function EditorPage() {
  const [currentTool, setCurrentTool] = useState('select');
  const [selectMode, setSelectMode] = useState('body');

  const [showShadows, setShowShadows] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const AXIS_ACTIVE = 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300';
  const AXIS_INACTIVE = 'bg-white hover:bg-gray-50';

  const [objects, setObjects] = useState([]);
  const historyRef = useRef([]);
  const futureRef = useRef([]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [primaryId, setPrimaryId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const dragTargetRef = useRef(null);
  const startXRef = useRef(0);
  const startLeftRef = useRef(DEFAULT_LEFT);
  const startRightRef = useRef(DEFAULT_RIGHT);

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);

  const lastLeftOpenRef = useRef(DEFAULT_LEFT);
  const lastRightOpenRef = useRef(DEFAULT_RIGHT);

  const HIT = 10;
  const MIN_CANVAS = 80;

  const leftVisible = leftWidth > 0;
  const rightVisible = rightWidth > 0;

  const [steelCatalog, setSteelCatalog] = useState({ channels: [], angles: [] });
  const [steelLoadError, setSteelLoadError] = useState('');
  const [steelDraft, setSteelDraft] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cat = await fetchSteelCatalog();
        if (!alive) return;
        setSteelCatalog(cat ?? { channels: [], angles: [] });
        setSteelLoadError('');
      } catch (e) {
        if (!alive) return;
        setSteelLoadError(String(e?.message ?? e));
        setSteelCatalog({ channels: [], angles: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ===== 平行移動（まとめ移動） =====
  // ✅ 文字列で持つ（- が入力できるように）
  const [moveDelta, setMoveDelta] = useState({ x: '0', y: '0', z: '0' });
  const panBaseRef = useRef(new Map());

  const moveDeltaN = useMemo(
    () => ({
      x: numLoose(moveDelta.x, 0),
      y: numLoose(moveDelta.y, 0),
      z: numLoose(moveDelta.z, 0),
    }),
    [moveDelta.x, moveDelta.y, moveDelta.z]
  );

  // ===== 回転（軸＋角度） =====
  const [rotAxis, setRotAxis] = useState('y');
  const [rotAngleDeg, setRotAngleDeg] = useState('0'); // ✅ string
  const rotBaseRef = useRef(new Map());

  const rotAngleDegN = useMemo(() => numLoose(rotAngleDeg, 0), [rotAngleDeg]);

  // ===== 複製：平行 =====
  const [dupMove, setDupMove] = useState({ x: '0', y: '0', z: '0' }); // ✅ string
  const dupMoveN = useMemo(
    () => ({
      x: numLoose(dupMove.x, 0),
      y: numLoose(dupMove.y, 0),
      z: numLoose(dupMove.z, 0),
    }),
    [dupMove.x, dupMove.y, dupMove.z]
  );

  // ===== 複製：回転 =====
  const [dupRotAxis, setDupRotAxis] = useState('y');
  const [dupRotDeg, setDupRotDeg] = useState('90'); // ✅ string
  const dupRotDegN = useMemo(() => numLoose(dupRotDeg, 0), [dupRotDeg]);

  // ===== 複製：ミラー =====
  const [dupMirrorAxis, setDupMirrorAxis] = useState('x');

  const groupCountRef = useRef(1);
  const fusedCountRef = useRef(1);

  const groups = useMemo(() => objects.filter((o) => o.type === 'group'), [objects]);
  const shapes = useMemo(() => objects.filter((o) => o.type !== 'group'), [objects]);

  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const childrenByGroupId = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g.children ?? []);
    return m;
  }, [groups]);

  function getGroupChildren(groupId) {
    return childrenByGroupId.get(groupId) ?? [];
  }

  function expandSelectionToShapes(ids) {
    const out = new Set();
    for (const id of ids) {
      const g = groupById.get(id);
      if (g) {
        for (const cid of g.children ?? []) out.add(cid);
      } else {
        out.add(id);
      }
    }
    const final = new Set();
    for (const id of out) {
      const s = shapes.find((x) => x.id === id);
      const pg = s?.parentGroupId;
      if (pg && groupById.get(pg)) {
        for (const cid of getGroupChildren(pg)) final.add(cid);
      } else {
        final.add(id);
      }
    }
    return Array.from(final).filter((id) => shapes.some((s) => s.id === id));
  }

  const [addDraft, setAddDraft] = useState(null);

  function openAdd(type) {
    if (type === 'cube') {
      setAddDraft({ type: 'cube', edge: MM_BASE });
      return;
    }
    if (type === 'box') {
      setAddDraft({ type: 'box', size: [MM_BASE, MM_BASE, MM_BASE] });
      return;
    }
    if (type === 'cylinder') {
      setAddDraft({
        type: 'cylinder',
        radiusMode: 'diameter',
        diameter: MM_BASE,
        radius: MM_BASE / 2,
        height: MM_BASE,
      });
      return;
    }
    if (type === 'cone') {
      setAddDraft({
        type: 'cone',
        radiusMode: 'diameter',
        diameter: MM_BASE,
        radius: MM_BASE / 2,
        height: MM_BASE,
      });
      return;
    }
  }

  function placeDraft() {
    if (!addDraft?.type) return;

    if (addDraft.type === 'cube') {
      const e = Math.max(0.001, num(addDraft.edge, MM_BASE));
      add('cube', { size: [e, e, e], position: [0, e / 2, 0] });
      setAddDraft(null);
      return;
    }

    if (addDraft.type === 'box') {
      const s = addDraft.size ?? [MM_BASE, MM_BASE, MM_BASE];
      const w = Math.max(0.001, num(s[0], MM_BASE));
      const h = Math.max(0.001, num(s[1], MM_BASE));
      const d = Math.max(0.001, num(s[2], MM_BASE));
      add('box', { size: [w, h, d], position: [0, h / 2, 0] });
      setAddDraft(null);
      return;
    }

    if (addDraft.type === 'cylinder') {
      const mode = addDraft.radiusMode ?? 'diameter';
      const h = Math.max(0.001, num(addDraft.height, MM_BASE));
      const r =
        mode === 'radius'
          ? Math.max(0.001, num(addDraft.radius, MM_BASE / 2))
          : Math.max(0.001, num(addDraft.diameter, MM_BASE) / 2);

      add('cylinder', { radius: r, height: h, position: [0, h / 2, 0] });
      setAddDraft(null);
      return;
    }

    if (addDraft.type === 'cone') {
      const mode = addDraft.radiusMode ?? 'diameter';
      const h = Math.max(0.001, num(addDraft.height, MM_BASE));
      const r =
        mode === 'radius'
          ? Math.max(0.001, num(addDraft.radius, MM_BASE / 2))
          : Math.max(0.001, num(addDraft.diameter, MM_BASE) / 2);

      add('cone', { radius: r, height: h, position: [0, h / 2, 0] });
      setAddDraft(null);
      return;
    }
  }

  function canSetLeft(newLeft) {
    const total = containerRef.current?.clientWidth ?? 1200;
    const canvas = total - newLeft - rightWidth - HIT * 2;
    return canvas >= MIN_CANVAS;
  }
  function canSetRight(newRight) {
    const total = containerRef.current?.clientWidth ?? 1200;
    const canvas = total - leftWidth - newRight - HIT * 2;
    return canvas >= MIN_CANVAS;
  }

  function openSteel() {
    setAddDraft(null);
    const first = steelCatalog.channels?.[0] ?? null;
    setSteelDraft({ kind: 'channel', name: first?.name ?? '', length: 6000 });

    if (rightWidth <= 0) {
      const back = lastRightOpenRef.current > 0 ? lastRightOpenRef.current : DEFAULT_RIGHT;
      if (canSetRight(back)) setRightWidth(back);
      else setRightWidth(DEFAULT_RIGHT);
    }
  }

  function placeSteel() {
    if (!steelDraft) return;

    const len = Math.max(1, num(steelDraft.length, 6000));
    const kind = steelDraft.kind ?? 'channel';
    const list = kind === 'channel' ? steelCatalog.channels : steelCatalog.angles;

    const row =
      list.find((r) => String(r.name).trim() === String(steelDraft.name).trim()) ?? list[0] ?? null;

    if (!row) {
      window.alert('規格が選ばれていません');
      return;
    }

    if (kind === 'channel') {
      const H = Math.max(1, num(row.H, 100));
      const B = Math.max(1, num(row.B, 50));
      add('steel-channel', {
        name: `CH-${row.name}-${Math.round(len)}`,
        steel: { kind, ...row, length: len },
        size: [len, H, B],
        position: [0, H / 2, 0],
        color: '#bfbfbf',
      });
      setSteelDraft(null);
      return;
    }

    if (kind === 'angle') {
      const A = Math.max(1, num(row.A, 50));
      const B = Math.max(1, num(row.B, 50));
      add('steel-angle', {
        name: `L-${row.name}-${Math.round(len)}`,
        steel: { kind, ...row, length: len },
        size: [len, A, B],
        position: [0, A / 2, 0],
        color: '#bfbfbf',
      });
      setSteelDraft(null);
      return;
    }
  }

  useEffect(() => {
    if (historyRef.current.length > 0) return;

    try {
      const lw = Number(localStorage.getItem(LS_LEFT));
      const rw = Number(localStorage.getItem(LS_RIGHT));
      if (Number.isFinite(lw)) {
        setLeftWidth(lw);
        if (lw > 0) lastLeftOpenRef.current = lw;
      }
      if (Number.isFinite(rw)) {
        setRightWidth(rw);
        if (rw > 0) lastRightOpenRef.current = rw;
      }
    } catch {}

    const firstId = uid();
    const initH = MM_BASE;
    const init = [
      {
        id: firstId,
        type: 'box',
        name: 'box1',
        size: [MM_BASE * 2, initH, MM_BASE],
        position: [0, initH / 2, 0],
        pivot: [0, 0, 0],
        rotation: [0, 0, 0],
        color: '#bfbfbf',
      },
    ];

    setObjects(init);
    historyRef.current = [init];

    setSelectedIds([firstId]);
    setPrimaryId(firstId);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LEFT, String(leftWidth));
      localStorage.setItem(LS_RIGHT, String(rightWidth));
    } catch {}
  }, [leftWidth, rightWidth]);

  function commit(nextObjects) {
    historyRef.current.push(nextObjects);
    futureRef.current = [];
    setObjects(nextObjects);

    const exist = new Set(nextObjects.map((o) => o.id));
    setSelectedIds((prev) => prev.filter((id) => exist.has(id)));
    setPrimaryId((prev) => (prev && exist.has(prev) ? prev : null));
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    futureRef.current.unshift(current);
    const prev = historyRef.current[historyRef.current.length - 1];
    setObjects(prev);
    const exist = new Set(prev.map((o) => o.id));
    setSelectedIds((ids) => ids.filter((id) => exist.has(id)));
    setPrimaryId((pid) => (pid && exist.has(pid) ? pid : null));
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.shift();
    historyRef.current.push(next);
    setObjects(next);
    const exist = new Set(next.map((o) => o.id));
    setSelectedIds((ids) => ids.filter((id) => exist.has(id)));
    setPrimaryId((pid) => (pid && exist.has(pid) ? pid : null));
  }

  function nextNameForType(type) {
    const count = shapes.filter((o) => o.type === type).length + 1;
    return `${type}${count}`;
  }

  function add(type, data = {}) {
    const id = uid();
    const next = [
      {
        id,
        type,
        name: nextNameForType(type),
        position: [0, MM_BASE / 2, 0],
        pivot: [0, 0, 0],
        rotation: [0, 0, 0],
        color: '#bfbfbf',
        ...data,
      },
      ...objects,
    ];
    commit(next);

    setSelectedIds([id]);
    setPrimaryId(id);
    setCurrentTool('select');
    setSelectMode('body');
  }

  function selectSingle(id) {
    if (!id) {
      setSelectedIds([]);
      setPrimaryId(null);
      return;
    }
    const s = shapes.find((x) => x.id === id);
    const pg = s?.parentGroupId;
    if (pg && groupById.get(pg)) {
      const kids = getGroupChildren(pg);
      setSelectedIds(kids);
      setPrimaryId(id);
      return;
    }

    const g = groupById.get(id);
    if (g) {
      const kids = g.children ?? [];
      setSelectedIds(kids);
      setPrimaryId(kids[0] ?? null);
      return;
    }

    setSelectedIds([id]);
    setPrimaryId(id);
  }

  function toggleSelect(id) {
    if (!id) return;

    const g = groupById.get(id);
    if (g) {
      const kids = g.children ?? [];
      setSelectedIds((prev) => {
        const s = new Set(prev);
        const anySelected = kids.some((k) => s.has(k));
        if (anySelected) kids.forEach((k) => s.delete(k));
        else kids.forEach((k) => s.add(k));
        return Array.from(s);
      });
      setPrimaryId((prev) => prev ?? kids[0] ?? null);
      return;
    }

    const shape = shapes.find((x) => x.id === id);
    const pg = shape?.parentGroupId;
    if (pg && groupById.get(pg)) {
      const kids = getGroupChildren(pg);
      setSelectedIds((prev) => {
        const s = new Set(prev);
        const anySelected = kids.some((k) => s.has(k));
        if (anySelected) kids.forEach((k) => s.delete(k));
        else kids.forEach((k) => s.add(k));
        return Array.from(s);
      });
      setPrimaryId(id);
      return;
    }

    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
    setPrimaryId(id);
  }

  function handleSelectFromCanvas(id, evt) {
    if (!id) return selectSingle(null);
    const shift = !!(evt?.shiftKey || evt?.nativeEvent?.shiftKey);
    if (shift) toggleSelect(id);
    else selectSingle(id);
  }

  function handleSelectFromTree(id, evt) {
    const shift = !!evt?.shiftKey;
    if (shift) toggleSelect(id);
    else selectSingle(id);
  }

  const primaryObject = useMemo(() => shapes.find((o) => o.id === primaryId) ?? null, [shapes, primaryId]);
  const singleSelection = selectedIds.length === 1 && !!primaryObject;

  function updateObject(id, patch) {
    const next = objects.map((o) => (o.id === id ? { ...o, ...patch } : o));
    commit(next);
  }

  function updatePrimary(patch) {
    if (!primaryId) return;
    updateObject(primaryId, patch);
  }

  function setPrimaryXYZ(axis, value) {
    if (!primaryObject) return;
    const p = primaryObject.position ?? [0, 0, 0];
    const x = axis === 'x' ? num(value, p[0]) : p[0];
    const y = axis === 'y' ? num(value, p[1]) : p[1];
    const z = axis === 'z' ? num(value, p[2]) : p[2];
    updatePrimary({ position: [x, y, z] });
  }

  function setPivotForPrimary(newPivotLocal) {
    if (!primaryObject) return;
    const oldPivot = primaryObject.pivot ?? [0, 0, 0];
    const pos = primaryObject.position ?? [0, MM_BASE / 2, 0];

    const dx = newPivotLocal[0] - oldPivot[0];
    const dy = newPivotLocal[1] - oldPivot[1];
    const dz = newPivotLocal[2] - oldPivot[2];

    updatePrimary({
      pivot: [newPivotLocal[0], newPivotLocal[1], newPivotLocal[2]],
      position: [pos[0] + dx, pos[1] + dy, pos[2] + dz],
    });
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;

    const shapeIds = expandSelectionToShapes(selectedIds);
    const groupIds = selectedIds.filter((id) => groupById.get(id));
    const delSet = new Set([...shapeIds]);

    const next = objects
      .map((o) => {
        if (o.type === 'group') {
          const kids = (o.children ?? []).filter((cid) => !delSet.has(cid));
          return { ...o, children: kids };
        }
        return o;
      })
      .filter((o) => {
        if (delSet.has(o.id)) return false;
        if (groupIds.includes(o.id)) return false;
        if (o.type === 'group' && (o.children ?? []).length === 0) return false;
        return true;
      });

    const groupExists = (id) => next.some((x) => x.type === 'group' && x.id === id);

    const fixed = next.map((o) => {
      if (o.type !== 'group' && o.parentGroupId && !groupExists(o.parentGroupId)) {
        const { parentGroupId, ...rest } = o;
        return rest;
      }
      return o;
    });

    commit(fixed);
    setSelectedIds([]);
    setPrimaryId(null);
  }

  function renameObject(id) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const current = obj.name ?? '';
    const next = window.prompt('名前を入力してください', current);
    if (next == null) return;
    const trimmed = String(next).trim();
    if (!trimmed) return;
    updateObject(id, { name: trimmed });
  }

  function groupSelected() {
    const shapeIds = expandSelectionToShapes(selectedIds);
    if (shapeIds.length < 2) return;

    const gid = uid();
    const gname = `group${groupCountRef.current++}`;

    const next = objects.map((o) => {
      if (o.type === 'group') {
        const kids = (o.children ?? []).filter((cid) => !shapeIds.includes(cid));
        return { ...o, children: kids };
      }
      if (o.type !== 'group' && shapeIds.includes(o.id)) {
        return { ...o, parentGroupId: gid };
      }
      return o;
    });

    const withNewGroup = [
      { id: gid, type: 'group', name: gname, children: shapeIds },
      ...next.filter((o) => !(o.type === 'group' && (o.children ?? []).length === 0)),
    ];

    commit(withNewGroup);
    setSelectedIds(shapeIds);
    setPrimaryId(shapeIds[0] ?? null);
  }

  function ungroupSelected() {
    const gids = new Set();

    for (const id of selectedIds) {
      const g = groupById.get(id);
      if (g) gids.add(g.id);
      const s = shapes.find((x) => x.id === id);
      if (s?.parentGroupId && groupById.get(s.parentGroupId)) gids.add(s.parentGroupId);
    }

    if (gids.size === 0) return;

    const gidList = Array.from(gids);

    const allKids = [];
    for (const gid of gidList) allKids.push(...getGroupChildren(gid));

    const next = objects
      .filter((o) => !(o.type === 'group' && gidList.includes(o.id)))
      .map((o) => {
        if (o.type !== 'group' && gidList.includes(o.parentGroupId)) {
          const { parentGroupId, ...rest } = o;
          return rest;
        }
        return o;
      });

    commit(next);
    setSelectedIds(allKids.filter((id) => next.some((o) => o.id === id)));
    setPrimaryId(allKids[0] ?? null);
  }

  function fuseSelected() {
    const shapeIds = expandSelectionToShapes(selectedIds);
    if (shapeIds.length < 2) return;

    const srcShapes = shapes.filter((s) => shapeIds.includes(s.id));
    if (srcShapes.length < 2) return;

    let sx = 0,
      sy = 0,
      sz = 0;
    for (const s of srcShapes) {
      const p = s.position ?? [0, 0, 0];
      sx += p[0];
      sy += p[1];
      sz += p[2];
    }
    const basePos = [sx / srcShapes.length, sy / srcShapes.length, sz / srcShapes.length];

    const fusedId = uid();
    const fusedName = `fused${fusedCountRef.current++}`;

    const sources = srcShapes.map((s) => {
      const p = s.position ?? [0, 0, 0];
      const r = s.rotation ?? [0, 0, 0];

      return {
        type: s.type,
        size: s.size,
        radius: s.radius,
        height: s.height,
        steel: s.steel,
        localPosition: [p[0] - basePos[0], p[1] - basePos[1], p[2] - basePos[2]],
        localRotation: [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0],
      };
    });

    const delSet = new Set(shapeIds);

    const next = objects
      .map((o) => {
        if (o.type === 'group') {
          const kids = (o.children ?? []).filter((cid) => !delSet.has(cid));
          return { ...o, children: kids };
        }
        return o;
      })
      .filter((o) => {
        if (delSet.has(o.id)) return false;
        if (o.type === 'group' && (o.children ?? []).length === 0) return false;
        return true;
      });

    const color = srcShapes[0]?.color ?? '#bfbfbf';

    const fusedObj = {
      id: fusedId,
      type: 'fused',
      name: fusedName,
      position: basePos,
      pivot: [0, 0, 0],
      rotation: [0, 0, 0],
      color,
      sources,
    };

    const withFused = [fusedObj, ...next];
    commit(withFused);

    setSelectedIds([fusedId]);
    setPrimaryId(fusedId);
    setCurrentTool('select');
    setSelectMode('body');
  }

  function rebuildPanBase() {
    const m = new Map();
    const shapeIds = expandSelectionToShapes(selectedIds);
    for (const o of shapes) {
      if (shapeIds.includes(o.id)) {
        const p = o.position ?? [0, 0, 0];
        m.set(o.id, [p[0], p[1], p[2]]);
      }
    }
    panBaseRef.current = m;
  }

  function previewPanDelta(delta) {
    const base = panBaseRef.current;
    if (!base || base.size === 0) return;
    setObjects((prev) =>
      prev.map((o) => {
        if (o.type === 'group') return o;
        if (!base.has(o.id)) return o;
        const b = base.get(o.id);
        return { ...o, position: [b[0] + delta.x, b[1] + delta.y, b[2] + delta.z] };
      })
    );
  }

  function commitPanDelta(delta) {
    const base = panBaseRef.current;
    if (!base || base.size === 0) return;

    const next = objects.map((o) => {
      if (o.type === 'group') return o;
      if (!base.has(o.id)) return o;
      const b = base.get(o.id);
      return { ...o, position: [b[0] + delta.x, b[1] + delta.y, b[2] + delta.z] };
    });
    commit(next);

    setMoveDelta({ x: '0', y: '0', z: '0' });
  }

  useEffect(() => {
    if (currentTool !== 'pan') return;
    rebuildPanBase();
    setMoveDelta({ x: '0', y: '0', z: '0' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, selectedIds.join('|')]);

  useEffect(() => {
    if (currentTool !== 'pan') return;
    previewPanDelta(moveDeltaN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveDeltaN.x, moveDeltaN.y, moveDeltaN.z, currentTool]);

  function rebuildRotBase() {
    const m = new Map();
    const shapeIds = expandSelectionToShapes(selectedIds);
    for (const o of shapes) {
      if (shapeIds.includes(o.id)) {
        const r = o.rotation ?? [0, 0, 0];
        m.set(o.id, [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0]);
      }
    }
    rotBaseRef.current = m;
  }

  function previewRotate(angleDeg) {
    const base = rotBaseRef.current;
    if (!base || base.size === 0) return;

    const a = degToRad(angleDeg);
    const axis = rotAxis;

    setObjects((prev) =>
      prev.map((o) => {
        if (o.type === 'group') return o;
        if (!base.has(o.id)) return o;
        const b = base.get(o.id);
        const r = [b[0], b[1], b[2]];
        if (axis === 'x') r[0] = b[0] + a;
        if (axis === 'y') r[1] = b[1] + a;
        if (axis === 'z') r[2] = b[2] + a;
        return { ...o, rotation: r };
      })
    );
  }

  function commitRotate(angleDeg) {
    const base = rotBaseRef.current;
    if (!base || base.size === 0) return;

    const a = degToRad(angleDeg);
    const axis = rotAxis;

    const next = objects.map((o) => {
      if (o.type === 'group') return o;
      if (!base.has(o.id)) return o;
      const b = base.get(o.id);
      const r = [b[0], b[1], b[2]];
      if (axis === 'x') r[0] = b[0] + a;
      if (axis === 'y') r[1] = b[1] + a;
      if (axis === 'z') r[2] = b[2] + a;
      return { ...o, rotation: r };
    });

    commit(next);
    setRotAngleDeg('0');
  }

  function quickRotate(deg) {
    if (selectedIds.length === 0) return;
    setRotAngleDeg('0');
    rebuildRotBase();
    commitRotate(deg);
  }

  useEffect(() => {
    if (currentTool !== 'rotate') return;
    rebuildRotBase();
    setRotAngleDeg('0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, selectedIds.join('|')]);

  useEffect(() => {
    if (currentTool !== 'rotate') return;
    previewRotate(rotAngleDegN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotAngleDegN, rotAxis, currentTool]);

  function makeCopyName(baseName, index) {
    const n = baseName?.trim() ? baseName.trim() : 'object';
    return `${n}_copy${index}`;
  }

  function cloneObject(o, patch = {}, copyIndex = 1) {
    return {
      ...structuredClone(o),
      id: uid(),
      name: makeCopyName(o.name ?? o.type, copyIndex),
      ...patch,
    };
  }

  function duplicateTranslate(dx, dy, dz) {
    const shapeIds = expandSelectionToShapes(selectedIds);
    if (shapeIds.length === 0) return;

    const src = shapes.filter((o) => shapeIds.includes(o.id));
    const copies = src.map((o, i) => {
      const p = o.position ?? [0, 0, 0];
      return cloneObject(
        o,
        { position: [p[0] + dx, p[1] + dy, p[2] + dz], parentGroupId: undefined },
        i + 1
      );
    });

    const next = [...copies, ...objects];
    commit(next);

    setSelectedIds(copies.map((o) => o.id));
    setPrimaryId(copies[0]?.id ?? null);
  }

  function duplicateRotate(axis, deg) {
    const shapeIds = expandSelectionToShapes(selectedIds);
    if (shapeIds.length === 0) return;

    const a = degToRad(deg);

    const src = shapes.filter((o) => shapeIds.includes(o.id));
    const copies = src.map((o, i) => {
      const r = o.rotation ?? [0, 0, 0];
      const nr = [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0];
      if (axis === 'x') nr[0] += a;
      if (axis === 'y') nr[1] += a;
      if (axis === 'z') nr[2] += a;

      return cloneObject(o, { rotation: nr, parentGroupId: undefined }, i + 1);
    });

    const next = [...copies, ...objects];
    commit(next);

    setSelectedIds(copies.map((o) => o.id));
    setPrimaryId(copies[0]?.id ?? null);
  }

  function duplicateMirror(axis) {
    const shapeIds = expandSelectionToShapes(selectedIds);
    if (shapeIds.length === 0) return;

    const src = shapes.filter((o) => shapeIds.includes(o.id));
    const copies = src.map((o, i) => {
      const p = o.position ?? [0, 0, 0];
      const pv = o.pivot ?? [0, 0, 0];
      const r = o.rotation ?? [0, 0, 0];

      const np = [p[0], p[1], p[2]];
      const npv = [pv[0], pv[1], pv[2]];
      const nr = [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0];

      if (axis === 'x') {
        np[0] = -p[0];
        npv[0] = -pv[0];
        nr[1] = -nr[1];
        nr[2] = -nr[2];
      }
      if (axis === 'y') {
        np[1] = -p[1];
        npv[1] = -pv[1];
        nr[0] = -nr[0];
        nr[2] = -nr[2];
      }
      if (axis === 'z') {
        np[2] = -p[2];
        npv[2] = -pv[2];
        nr[0] = -nr[0];
        nr[1] = -nr[1];
      }

      return cloneObject(o, { position: np, pivot: npv, rotation: nr, parentGroupId: undefined }, i + 1);
    });

    const next = [...copies, ...objects];
    commit(next);

    setSelectedIds(copies.map((o) => o.id));
    setPrimaryId(copies[0]?.id ?? null);
  }

  useEffect(() => {
    const isTyping = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    const onKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete') {
        if (isTyping(document.activeElement)) return;
        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, objects]);

  function startDrag(which, e) {
    e.preventDefault();
    draggingRef.current = true;
    dragTargetRef.current = which;
    startXRef.current = e.clientX;
    startLeftRef.current = leftWidth;
    startRightRef.current = rightWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;

      if (dragTargetRef.current === 'left') {
        const nextLeft = Math.max(0, startLeftRef.current + dx);
        if (canSetLeft(nextLeft)) {
          setLeftWidth(nextLeft);
          if (nextLeft > 0) lastLeftOpenRef.current = nextLeft;
        }
      }

      if (dragTargetRef.current === 'right') {
        const nextRight = Math.max(0, startRightRef.current - dx);
        if (canSetRight(nextRight)) {
          setRightWidth(nextRight);
          if (nextRight > 0) lastRightOpenRef.current = nextRight;
        }
      }
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      dragTargetRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [leftWidth, rightWidth]);

  function toggleCollapseLeft() {
    if (leftWidth <= 0) {
      const back = lastLeftOpenRef.current > 0 ? lastLeftOpenRef.current : DEFAULT_LEFT;
      if (canSetLeft(back)) setLeftWidth(back);
      else setLeftWidth(0);
    } else {
      lastLeftOpenRef.current = leftWidth;
      setLeftWidth(0);
    }
  }
  function toggleCollapseRight() {
    if (rightWidth <= 0) {
      const back = lastRightOpenRef.current > 0 ? lastRightOpenRef.current : DEFAULT_RIGHT;
      if (canSetRight(back)) setRightWidth(back);
      else setRightWidth(0);
    } else {
      lastRightOpenRef.current = rightWidth;
      setRightWidth(0);
    }
  }

  function resetLayout() {
    setLeftWidth(DEFAULT_LEFT);
    setRightWidth(DEFAULT_RIGHT);
    lastLeftOpenRef.current = DEFAULT_LEFT;
    lastRightOpenRef.current = DEFAULT_RIGHT;
  }
  function toggleLeftVisible() {
    toggleCollapseLeft();
  }
  function toggleRightVisible() {
    toggleCollapseRight();
  }

  const ResizeArrows = (
    <svg width="44" height="12" viewBox="0 0 44 12" aria-hidden="true">
      <path d="M12 6H32" stroke="black" strokeWidth="1" />
      <path d="M12 6L17 1" stroke="black" strokeWidth="1" />
      <path d="M12 6L17 11" stroke="black" strokeWidth="1" />
      <path d="M32 6L27 1" stroke="black" strokeWidth="1" />
      <path d="M32 6L27 11" stroke="black" strokeWidth="1" />
    </svg>
  );

  function Splitter({ onMouseDown, onDoubleClick }) {
    return (
      <div
        className="relative select-none"
        style={{ width: HIT }}
        onMouseDown={onMouseDown}
        onDoubleClick={(e) => {
          e.preventDefault();
          onDoubleClick?.();
        }}
        title="ドラッグでサイズ変更 / ダブルクリックで折りたたみ"
      >
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gray-300" />
        <div className="group absolute inset-0 cursor-col-resize">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-white/80 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {ResizeArrows}
          </div>
        </div>
      </div>
    );
  }

  const QuickBtn = ({ deg }) => (
    <button
      className={`rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
        selectedIds.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
      }`}
      onClick={() => {
        if (selectedIds.length === 0) return;
        quickRotate(deg);
      }}
      title={`${deg > 0 ? '+' : ''}${deg}° を確定回転`}
      type="button"
    >
      {deg > 0 ? `+${deg}°` : `${deg}°`}
    </button>
  );

  const expandedShapeSelection = useMemo(() => expandSelectionToShapes(selectedIds), [selectedIds.join('|'), objects]);
  const canGroup = expandedShapeSelection.length >= 2;
  const canFuse = expandedShapeSelection.length >= 2;
  const canUngroup = useMemo(() => {
    for (const id of selectedIds) {
      if (groupById.get(id)) return true;
      const s = shapes.find((x) => x.id === id);
      if (s?.parentGroupId && groupById.get(s.parentGroupId)) return true;
    }
    return false;
  }, [selectedIds.join('|'), shapes, groups]);

  function setPrimaryBoxSize(axisIndex, value) {
    if (!primaryObject) return;
    const s = primaryObject.size ?? [MM_BASE, MM_BASE, MM_BASE];
    const next = [s[0], s[1], s[2]];
    next[axisIndex] = Math.max(0.001, num(value, s[axisIndex]));
    updatePrimary({ size: next });
  }
  function setPrimaryCubeEdge(value) {
    if (!primaryObject) return;
    const e = Math.max(0.001, num(value, MM_BASE));
    updatePrimary({ size: [e, e, e] });
  }
  function setPrimaryHeight(value) {
    if (!primaryObject) return;
    updatePrimary({ height: Math.max(0.001, num(value, primaryObject.height ?? MM_BASE)) });
  }
  function setPrimaryRadius(value) {
    if (!primaryObject) return;
    updatePrimary({ radius: Math.max(0.001, num(value, primaryObject.radius ?? MM_BASE / 2)) });
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <EditorToolbar
        currentTool={currentTool}
        setTool={setCurrentTool}
        selectMode={selectMode}
        setSelectMode={setSelectMode}
        onAddCube={() => openAdd('cube')}
        onAddBox={() => openAdd('box')}
        onAddCylinder={() => openAdd('cylinder')}
        onAddCone={() => openAdd('cone')}
        onOpenSteelPanel={openSteel}
        onDeleteSelected={deleteSelected}
        canDelete={selectedIds.length > 0}
        onResetLayout={resetLayout}
        leftVisible={leftVisible}
        rightVisible={rightVisible}
        onToggleLeft={toggleLeftVisible}
        onToggleRight={toggleRightVisible}
        onGroupSelected={groupSelected}
        onUngroupSelected={ungroupSelected}
        onFuseSelected={fuseSelected}
        canGroup={canGroup}
        canUngroup={canUngroup}
        canFuse={canFuse}
        showShadows={showShadows}
        showGrid={showGrid}
        onToggleShadows={() => setShowShadows((v) => !v)}
        onToggleGrid={() => setShowGrid((v) => !v)}
      />

      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* 左：構成ツリー */}
        <aside className="border-r bg-white flex flex-col min-h-0 overflow-hidden" style={{ width: leftWidth }}>
          <div className="border-b px-3 py-2 text-sm font-semibold truncate">構成ツリー</div>

          <div className="flex-1 overflow-auto p-2 space-y-2 text-xs">
            {groups.map((g, gi) => {
              const kids = g.children ?? [];
              const anySelected = kids.some((k) => selectedIds.includes(k));
              const label = g.name?.trim() ? g.name : `group${gi + 1}`;

              return (
                <div key={g.id} className={`rounded-lg border ${anySelected ? 'bg-gray-50 border-gray-400' : ''}`}>
                  <button
                    className="w-full text-left px-2 py-2 hover:bg-gray-50"
                    onClick={(e) => handleSelectFromTree(g.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      renameObject(g.id);
                    }}
                    title="右クリックで名前変更 / クリックでグループ選択"
                  >
                    <div className="font-semibold truncate">📦 {label}</div>
                    <div className="text-gray-500 truncate">group ({kids.length})</div>
                  </button>

                  <div className="px-2 pb-2 space-y-1">
                    {kids.map((cid) => {
                      const s = shapes.find((x) => x.id === cid);
                      if (!s) return null;
                      const active = selectedIds.includes(s.id);
                      const primary = s.id === primaryId;
                      const nm = s.name?.trim() ? s.name : s.type;
                      return (
                        <button
                          key={s.id}
                          className={`w-full text-left rounded border px-2 py-1 overflow-hidden ${
                            active ? 'bg-gray-100 border-gray-400' : 'hover:bg-gray-50'
                          } ${primary ? 'ring-2 ring-gray-400' : ''}`}
                          onClick={(e) => handleSelectFromTree(s.id, e)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            renameObject(s.id);
                          }}
                          title="右クリックで名前変更 / クリックするとグループ全体が選択されます"
                        >
                          <div className="truncate">- {nm}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {shapes
              .filter((s) => !s.parentGroupId)
              .map((o, i) => {
                const active = selectedIds.includes(o.id);
                const primary = o.id === primaryId;
                const label = o.name?.trim() ? o.name : o.type;

                return (
                  <button
                    key={o.id}
                    className={`w-full text-left rounded-lg border px-2 py-2 overflow-hidden ${
                      active ? 'bg-gray-100 border-gray-400' : 'hover:bg-gray-50'
                    } ${primary ? 'ring-2 ring-gray-400' : ''}`}
                    onClick={(e) => handleSelectFromTree(o.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      renameObject(o.id);
                    }}
                    title="右クリックで名前変更 / Shiftで複数選択"
                  >
                    <div className="font-semibold truncate">
                      {i + 1}. {label} {primary ? '(primary)' : ''}
                    </div>
                    <div className="text-gray-500 truncate">{o.type}</div>
                  </button>
                );
              })}
          </div>

          <div className="border-t p-2">
            <div className="text-[11px] text-gray-500 mb-2">Undo/Redo</div>
            <div className="flex gap-2 text-xs">
              <button className="rounded border px-2 py-1 hover:bg-gray-50" onClick={undo} type="button">
                ← 戻る
              </button>
              <button className="rounded border px-2 py-1 hover:bg-gray-50" onClick={redo} type="button">
                → やり直し
              </button>
            </div>
          </div>
        </aside>

        <Splitter onMouseDown={(e) => startDrag('left', e)} onDoubleClick={toggleCollapseLeft} />

        {/* 中央：Canvas */}
        <div className="flex-1 min-h-0 bg-gray-100">
          <EditorCanvas
            objects={objects}
            selectedIds={expandedShapeSelection.length ? expandedShapeSelection : selectedIds}
            primaryId={primaryId}
            hoveredId={hoveredId}
            onSelect={handleSelectFromCanvas}
            onHover={setHoveredId}
            currentTool={currentTool}
            selectMode={selectMode}
            onSetPivotLocal={setPivotForPrimary}
            onCommitMove={(id, pos) => updateObject(id, { position: pos })}
            onLiveMove={(id, pos) => {
              setObjects((prev) => prev.map((oo) => (oo.id === id ? { ...oo, position: pos } : oo)));
            }}
            onLivePanDelta={(delta) => setMoveDelta({ x: String(delta.x), y: String(delta.y), z: String(delta.z) })}
            onCommitPanDelta={(delta) => commitPanDelta(delta)}
            showShadows={showShadows}
            showGrid={showGrid}
          />
        </div>

        <Splitter onMouseDown={(e) => startDrag('right', e)} onDoubleClick={toggleCollapseRight} />

        {/* 右：構成ツール */}
        <aside className="border-l bg-white flex flex-col min-h-0 overflow-hidden" style={{ width: rightWidth }}>
          <div className="border-b px-3 py-2 text-sm font-semibold truncate">構成ツール</div>

          <div className="flex-1 overflow-auto p-3 space-y-4">
            <div className="text-xs text-gray-600">
              選択数: <span className="font-semibold">{expandedShapeSelection.length}</span>
            </div>

            {steelLoadError ? (
              <div className="rounded border p-2 text-xs">
                <div className="font-semibold text-red-600">鋼材カタログの読み込み失敗</div>
                <div className="text-[11px] text-gray-600 break-words mt-1">{steelLoadError}</div>
              </div>
            ) : null}

            {steelDraft ? (
              <SteelAddPanel
                catalog={steelCatalog}
                draft={steelDraft}
                setDraft={setSteelDraft}
                onPlace={placeSteel}
                onCancel={() => setSteelDraft(null)}
                disabled={!!steelLoadError}
              />
            ) : null}

            {/* ✅ 新規作成（略：元のまま） */}
            {/* ...（ここは元コードそのまま。省略してない版を使うなら、あなたのファイルのまま残してOK） */}

            {/* ===== 複製：平行 ===== */}
            {currentTool === 'dup-translate' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold">平行複製</div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔX(mm)</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="1"
                      value={dupMove.x}
                      onChange={(e) => setDupMove((d) => ({ ...d, x: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔY(mm)</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="1"
                      value={dupMove.y}
                      onChange={(e) => setDupMove((d) => ({ ...d, y: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔZ(mm)</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="1"
                      value={dupMove.z}
                      onChange={(e) => setDupMove((d) => ({ ...d, z: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  className={`w-full rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
                    expandedShapeSelection.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    if (expandedShapeSelection.length === 0) return;
                    duplicateTranslate(dupMoveN.x, dupMoveN.y, dupMoveN.z);
                  }}
                >
                  複製
                </button>

                <button
                  className="w-full rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  type="button"
                  onClick={() => setDupMove({ x: '0', y: '0', z: '0' })}
                >
                  リセット
                </button>
              </div>
            ) : null}

            {/* ===== 複製：回転 ===== */}
            {currentTool === 'dup-rotate' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold">回転複製</div>

                <div className="text-[11px] text-gray-500">軸</div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${dupRotAxis === 'x' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setDupRotAxis('x')}
                    type="button"
                  >
                    X
                  </button>
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${dupRotAxis === 'y' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setDupRotAxis('y')}
                    type="button"
                  >
                    Y
                  </button>
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${dupRotAxis === 'z' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setDupRotAxis('z')}
                    type="button"
                  >
                    Z
                  </button>
                </div>

                <div>
                  <div className="text-[10px] text-gray-500 mb-1">角度（度）</div>
                  <input
                    className="w-full rounded border px-2 py-1 text-xs"
                    type="number"
                    step="1"
                    value={dupRotDeg}
                    onChange={(e) => setDupRotDeg(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={() => setDupRotDeg('90')}>
                    90°
                  </button>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={() => setDupRotDeg('45')}>
                    45°
                  </button>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={() => setDupRotDeg('180')}>
                    180°
                  </button>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="button" onClick={() => setDupRotDeg('-90')}>
                    -90°
                  </button>
                </div>

                <button
                  className={`w-full rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
                    expandedShapeSelection.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    if (expandedShapeSelection.length === 0) return;
                    duplicateRotate(dupRotAxis, dupRotDegN);
                  }}
                >
                  複製
                </button>
              </div>
            ) : null}

            {/* ===== 回転ツール ===== */}
            {currentTool === 'rotate' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold">回転</div>

                <div className="text-[11px] text-gray-500">ワンタッチ（確定回転）</div>
                <div className="flex flex-wrap gap-2">
                  <QuickBtn deg={-90} />
                  <QuickBtn deg={-45} />
                  <QuickBtn deg={180} />
                  <QuickBtn deg={45} />
                  <QuickBtn deg={90} />
                </div>

                <div className="mt-2 text-[11px] text-gray-500">軸</div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${rotAxis === 'x' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setRotAxis('x')}
                    type="button"
                  >
                    X
                  </button>
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${rotAxis === 'y' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setRotAxis('y')}
                    type="button"
                  >
                    Y
                  </button>
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs ${rotAxis === 'z' ? AXIS_ACTIVE : AXIS_INACTIVE}`}
                    onClick={() => setRotAxis('z')}
                    type="button"
                  >
                    Z
                  </button>
                </div>

                <div>
                  <div className="text-[10px] text-gray-500 mb-1">角度（度）</div>
                  <input
                    className="w-full rounded border px-2 py-1 text-xs"
                    type="number"
                    step="1"
                    value={rotAngleDeg}
                    onChange={(e) => setRotAngleDeg(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
                      expandedShapeSelection.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    onClick={() => {
                      if (expandedShapeSelection.length === 0) return;
                      rebuildRotBase();
                      commitRotate(rotAngleDegN);
                    }}
                    type="button"
                  >
                    確定
                  </button>
                  <button
                    className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => setRotAngleDeg('0')}
                    type="button"
                  >
                    リセット
                  </button>
                </div>
              </div>
            ) : null}

            {/* ===== 平行移動 ===== */}
            {currentTool === 'pan' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold">平行移動（まとめて移動）</div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔX</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="10" // ✅ ホイールを速くする
                      value={moveDelta.x}
                      onChange={(e) => setMoveDelta((d) => ({ ...d, x: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔY</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="10"
                      value={moveDelta.y}
                      onChange={(e) => setMoveDelta((d) => ({ ...d, y: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">ΔZ</div>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      type="number"
                      step="10"
                      value={moveDelta.z}
                      onChange={(e) => setMoveDelta((d) => ({ ...d, z: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
                      expandedShapeSelection.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    onClick={() => {
                      if (expandedShapeSelection.length === 0) return;
                      rebuildPanBase();
                      commitPanDelta(moveDeltaN);
                    }}
                    type="button"
                  >
                    確定
                  </button>
                  <button
                    className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => setMoveDelta({ x: '0', y: '0', z: '0' })}
                    type="button"
                  >
                    リセット
                  </button>
                </div>
              </div>
            ) : null}

            {/* 以降（単体編集など）は元コードのままでOK */}
          </div>
        </aside>
      </div>
    </div>
  );
}
