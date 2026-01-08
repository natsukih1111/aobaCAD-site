
'use client';

import { Canvas } from '@react-three/fiber';
import { Grid, Outlines, TransformControls, GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CustomCameraControls from '@/components/CustomCameraControls';

const MM_BASE = 1000;

function isOrangeLike(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r >= 200 && g >= 90 && g <= 190 && b <= 120;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * ✅ steel-channel（チャンネル断面）: 直角U形（r1/r2は今は無視）
 */
function buildChannelGeometryFromSteel(steel, fallbackSize) {
  const H = Math.max(0.001, num(steel?.H, 100));
  const B = Math.max(0.001, num(steel?.B, 50));
  const t1 = Math.max(0.001, num(steel?.t1, 5));
  const t2 = Math.max(0.001, num(steel?.t2, 7.5));

  const L = Math.max(0.001, num(steel?.length, num(fallbackSize?.[0], MM_BASE)));

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(B, 0);
  shape.lineTo(B, t2);
  shape.lineTo(t1, t2);
  shape.lineTo(t1, H - t2);
  shape.lineTo(B, H - t2);
  shape.lineTo(B, H);
  shape.lineTo(0, H);
  shape.lineTo(0, 0);

  const hole = new THREE.Path();
  hole.moveTo(t1, t2);
  hole.lineTo(B, t2);
  hole.lineTo(B, H - t2);
  hole.lineTo(t1, H - t2);
  hole.lineTo(t1, t2);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: L,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  });

  geo.rotateY(Math.PI / 2);
  geo.translate(-L / 2, -H / 2, -B / 2);

  geo.computeVertexNormals();
  return geo;
}

/**
 * ✅ steel-angle（Lアングル）: 直角L形（rは今は無視）
 */
function buildAngleGeometryFromSteel(steel, fallbackSize) {
  const A = Math.max(0.001, num(steel?.A, 50));
  const B = Math.max(0.001, num(steel?.B, 50));
  const t = Math.max(0.001, num(steel?.t, 6));

  const L = Math.max(0.001, num(steel?.length, num(fallbackSize?.[0], MM_BASE)));

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(B, 0);
  shape.lineTo(B, t);
  shape.lineTo(t, t);
  shape.lineTo(t, A);
  shape.lineTo(0, A);
  shape.lineTo(0, 0);

  const hole = new THREE.Path();
  hole.moveTo(t, t);
  hole.lineTo(B, t);
  hole.lineTo(B, A);
  hole.lineTo(t, A);
  hole.lineTo(t, t);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: L,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  });

  geo.rotateY(Math.PI / 2);
  geo.translate(-L / 2, -A / 2, -B / 2);

  geo.computeVertexNormals();
  return geo;
}

function buildGeometryFromShape(shape) {
  if (shape.type === 'cube') {
    const s = shape.size ?? [MM_BASE, MM_BASE, MM_BASE];
    return new THREE.BoxGeometry(s[0], s[1], s[2]);
  }
  if (shape.type === 'box') {
    const s = shape.size ?? [MM_BASE, MM_BASE, MM_BASE];
    return new THREE.BoxGeometry(s[0], s[1], s[2]);
  }
  if (shape.type === 'cylinder') {
    const r = shape.radius ?? MM_BASE / 2;
    const h = shape.height ?? MM_BASE;
    return new THREE.CylinderGeometry(r, r, h, 24);
  }
  if (shape.type === 'cone') {
    const r = shape.radius ?? MM_BASE / 2;
    const h = shape.height ?? MM_BASE;
    return new THREE.ConeGeometry(r, h, 24);
  }

  if (shape.type === 'steel-channel') return buildChannelGeometryFromSteel(shape.steel, shape.size);
  if (shape.type === 'steel-angle') return buildAngleGeometryFromSteel(shape.steel, shape.size);

  return new THREE.BoxGeometry(MM_BASE, MM_BASE, MM_BASE);
}

function buildFusedGeometry(fused) {
  const sources = fused.sources ?? [];
  const geos = [];

  for (const s of sources) {
    const g = buildGeometryFromShape(s);
    const rp = s.localPosition ?? [0, 0, 0];
    const rr = s.localRotation ?? [0, 0, 0];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr[0] ?? 0, rr[1] ?? 0, rr[2] ?? 0));
    const t = new THREE.Vector3(rp[0] ?? 0, rp[1] ?? 0, rp[2] ?? 0);
    m.compose(t, q, new THREE.Vector3(1, 1, 1));

    g.applyMatrix4(m);
    geos.push(g);
  }

  if (geos.length === 0) return new THREE.BoxGeometry(MM_BASE, MM_BASE, MM_BASE);

  const merged = mergeGeometries(geos, true);
  for (const g of geos) g.dispose?.();

  merged.computeVertexNormals();
  return merged;
}

function uniqueVec3(list, eps = 1e-4) {
  const map = new Map();
  for (const v of list) {
    const k = `${Math.round(v.x / eps)}_${Math.round(v.y / eps)}_${Math.round(v.z / eps)}_${Math.round(v.z / eps)}`;
    if (!map.has(k)) map.set(k, v);
  }
  return Array.from(map.values());
}

function computeSnapPoints(obj) {
  const geo = obj.type === 'fused' ? new THREE.BoxGeometry(MM_BASE, MM_BASE, MM_BASE) : buildGeometryFromShape(obj);

  const posAttr = geo.getAttribute('position');
  const verts = [];
  for (let i = 0; i < posAttr.count; i++) {
    verts.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
  }
  const vertices = uniqueVec3(verts);

  const edges = new THREE.EdgesGeometry(geo);
  const ePos = edges.getAttribute('position');
  const mids = [];
  for (let i = 0; i < ePos.count; i += 2) {
    const a = new THREE.Vector3(ePos.getX(i), ePos.getY(i), ePos.getZ(i));
    const b = new THREE.Vector3(ePos.getX(i + 1), ePos.getY(i + 1), ePos.getZ(i + 1));
    mids.push(a.add(b).multiplyScalar(0.5));
  }
  const midpoints = uniqueVec3(mids);

  geo.dispose?.();
  edges.dispose?.();

  return { vertices, midpoints };
}

function nearestPoint(target, points) {
  let best = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = p.distanceToSquared(target);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function SnapDot({ position, kind, onSetPivotHere }) {
  const r = kind === 'vtx' ? 0.07 * MM_BASE * 0.001 : 0.055 * MM_BASE * 0.001;
  const hitR = 0.14 * MM_BASE * 0.001;
  const color = kind === 'vtx' ? '#ffffff' : '#4ea1ff';
  const edge = kind === 'vtx' ? '#111111' : '#083a7a';

  function setCursor(v) {
    document.body.style.cursor = v ? 'pointer' : '';
  }

  return (
    <group position={position}>
      <mesh renderOrder={50}>
        <sphereGeometry args={[r, 18, 18]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>

      <mesh renderOrder={49}>
        <sphereGeometry args={[r * 1.12, 12, 12]} />
        <meshBasicMaterial color={edge} wireframe depthTest={false} />
      </mesh>

      <mesh
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
        onPointerDown={(e) => {
          const btn = e.button ?? e.nativeEvent?.button;
          e.stopPropagation?.();
          e.nativeEvent?.preventDefault?.();
          if (btn === 0 || btn === 2) onSetPivotHere?.();
        }}
      >
        <sphereGeometry args={[hitR, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function PivotMiniAxes() {
  return (
    <group>
      <axesHelper args={[0.35 * MM_BASE * 0.001]} />
      <mesh renderOrder={60}>
        <sphereGeometry args={[0.045 * MM_BASE * 0.001, 14, 14]} />
        <meshBasicMaterial color="#ff8a00" depthTest={false} />
      </mesh>
    </group>
  );
}

function MeshBody({ obj, selected, hovered, isPrimary, onSelect, onHover, selectable, fusedGeometry, showShadows }) {
  const color = obj.color ?? '#bfbfbf';

  const outlineColorSelected = isPrimary ? '#ff8a00' : '#ffb020';
  const outlineColorHover = isOrangeLike(color) ? '#2f6bff' : '#ffb020';
  const showOutline = selected || hovered;
  const outlineColor = selected ? outlineColorSelected : outlineColorHover;

  const pivot = obj.pivot ?? [0, 0, 0];
  const meshOffset = [-pivot[0], -pivot[1], -pivot[2]];

  const Mat = <meshStandardMaterial key={color} color={color} />;

  const handlePointerDown = (e) => {
    e.stopPropagation?.();
    if (!selectable) return;
    const btn = e.button ?? e.nativeEvent?.button;
    if (btn === 2) return;
    onSelect?.(obj.id, e);
  };
  const handleOver = (e) => {
    e.stopPropagation?.();
    onHover?.(obj.id);
  };
  const handleOut = (e) => {
    e.stopPropagation?.();
    onHover?.(null);
  };

  const common = {
    position: meshOffset,
    castShadow: !!showShadows,
    receiveShadow: !!showShadows,
    onPointerDown: handlePointerDown,
    onPointerOver: handleOver,
    onPointerOut: handleOut,
  };

  if (obj.type === 'fused') {
    return (
      <mesh {...common} geometry={fusedGeometry}>
        {Mat}
        {showOutline ? <Outlines thickness={3} color={outlineColor} /> : null}
      </mesh>
    );
  }

  if (obj.type === 'steel-channel' || obj.type === 'steel-angle') {
    const geo = buildGeometryFromShape(obj);
    return (
      <mesh {...common} geometry={geo}>
        {Mat}
        {showOutline ? <Outlines thickness={3} color={outlineColor} /> : null}
      </mesh>
    );
  }

  if (obj.type === 'cube' || obj.type === 'box') {
    const s = obj.size ?? [MM_BASE, MM_BASE, MM_BASE];
    return (
      <mesh {...common}>
        <boxGeometry args={s} />
        {Mat}
        {showOutline ? <Outlines thickness={3} color={outlineColor} /> : null}
      </mesh>
    );
  }

  if (obj.type === 'cylinder') {
    const r = obj.radius ?? MM_BASE / 2;
    const h = obj.height ?? MM_BASE;
    return (
      <mesh {...common}>
        <cylinderGeometry args={[r, r, h, 24]} />
        {Mat}
        {showOutline ? <Outlines thickness={3} color={outlineColor} /> : null}
      </mesh>
    );
  }

  if (obj.type === 'cone') {
    const r = obj.radius ?? MM_BASE / 2;
    const h = obj.height ?? MM_BASE;
    return (
      <mesh {...common}>
        <coneGeometry args={[r, h, 24]} />
        {Mat}
        {showOutline ? <Outlines thickness={3} color={outlineColor} /> : null}
      </mesh>
    );
  }

  return null;
}

function centroidOfSelected(objects, selectedIds) {
  const pts = objects
    .filter((o) => selectedIds.includes(o.id))
    .map((o) => o.position ?? [0, 0, 0]);

  if (pts.length === 0) return [0, 0, 0];
  let sx = 0,
    sy = 0,
    sz = 0;
  for (const p of pts) {
    sx += p[0];
    sy += p[1];
    sz += p[2];
  }
  return [sx / pts.length, sy / pts.length, sz / pts.length];
}

export default function EditorCanvas({
  objects = [],
  selectedIds = [],
  primaryId = null,
  hoveredId = null,
  onSelect,
  onHover,

  currentTool = 'select',
  selectMode = 'body',
  zoomSensitivity = 1.0,

  onLiveMove,
  onCommitMove,
  onSetPivotLocal,

  onLivePanDelta,
  onCommitPanDelta,

  showShadows = true,
  showGrid = true,
}) {
  const isDup = currentTool === 'dup-translate' || currentTool === 'dup-rotate' || currentTool === 'dup-mirror';
  const selectable = currentTool === 'select' || currentTool === 'pan' || currentTool === 'rotate' || isDup;

  const drawable = useMemo(() => objects.filter((o) => o.type !== 'group'), [objects]);

  const singleSelection = selectedIds.length === 1 && !!primaryId;
  const primaryObj = useMemo(() => drawable.find((o) => o.id === primaryId) ?? null, [drawable, primaryId]);

  const groupRef = useRef(null);
  const tcMoveRef = useRef(null);

  const pivotHandleRef = useRef(null);
  const tcPivotRef = useRef(null);

  const panRef = useRef(null);
  const tcPanRef = useRef(null);
  const panStartPosRef = useRef(new THREE.Vector3(0, 0, 0));

  const [isTransforming, setIsTransforming] = useState(false);

  // ✅ Gizmo用のダミーcontrols（makeDefaultしない！）
  const gizmoControlsRef = useRef(null);

  const fusedGeometryMap = useMemo(() => {
    const map = new Map();
    for (const o of drawable) {
      if (o.type === 'fused') {
        map.set(o.id, buildFusedGeometry(o));
      }
    }
    return map;
  }, [drawable]);

  useEffect(() => {
    return () => {
      for (const g of fusedGeometryMap.values()) g.dispose?.();
    };
  }, [fusedGeometryMap]);

  const snap = useMemo(() => {
    if (!primaryObj) return { vertices: [], midpoints: [] };
    return computeSnapPoints(primaryObj);
  }, [primaryObj]);

  const pivot = primaryObj?.pivot ?? [0, 0, 0];
  const pivotVec = useMemo(() => new THREE.Vector3(pivot[0], pivot[1], pivot[2]), [pivot]);

  const verticesGroup = useMemo(() => snap.vertices.map((v) => v.clone().sub(pivotVec)), [snap.vertices, pivotVec]);
  const midpointsGroup = useMemo(() => snap.midpoints.map((v) => v.clone().sub(pivotVec)), [snap.midpoints, pivotVec]);
  const snapPointsGroup = useMemo(() => [...verticesGroup, ...midpointsGroup], [verticesGroup, midpointsGroup]);

  useEffect(() => {
    const tc = tcMoveRef.current;
    if (!tc) return;

    const onDraggingChanged = (e) => {
      const dragging = !!e.value;
      setIsTransforming(dragging);

      if (!dragging && groupRef.current && primaryId) {
        const p = groupRef.current.position;
        onCommitMove?.(primaryId, [p.x, p.y, p.z]);
      }
    };

    const onObjChange = () => {
      if (!groupRef.current || !primaryId) return;
      const p = groupRef.current.position;
      onLiveMove?.(primaryId, [p.x, p.y, p.z]);
    };

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('objectChange', onObjChange);
    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('objectChange', onObjChange);
    };
  }, [onLiveMove, onCommitMove, primaryId]);

  useEffect(() => {
    const tc = tcPivotRef.current;
    if (!tc) return;

    const onDraggingChanged = (e) => {
      const dragging = !!e.value;
      setIsTransforming(dragging);

      if (!dragging && pivotHandleRef.current && primaryObj) {
        const h = pivotHandleRef.current.position.clone();
        const near = nearestPoint(h, snapPointsGroup);
        if (!near) return;

        const newPivotLocal = near.clone().add(pivotVec);
        onSetPivotLocal?.([newPivotLocal.x, newPivotLocal.y, newPivotLocal.z]);

        pivotHandleRef.current.position.set(0, 0, 0);
      }
    };

    const onObjChange = () => {
      if (!pivotHandleRef.current) return;
      const h = pivotHandleRef.current.position.clone();
      const near = nearestPoint(h, snapPointsGroup);
      if (near) pivotHandleRef.current.position.copy(near);
    };

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('objectChange', onObjChange);
    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('objectChange', onObjChange);
    };
  }, [snapPointsGroup, pivotVec, onSetPivotLocal, primaryObj]);

  function setPivotAtGroupPoint(groupPoint) {
    if (!primaryObj) return;
    const newPivotLocal = groupPoint.clone().add(pivotVec);
    onSetPivotLocal?.([newPivotLocal.x, newPivotLocal.y, newPivotLocal.z]);
  }

  useEffect(() => {
    const tc = tcPanRef.current;
    if (!tc) return;

    const onDraggingChanged = (e) => {
      const dragging = !!e.value;
      setIsTransforming(dragging);

      if (!dragging && panRef.current) {
        const p = panRef.current.position;
        const d = new THREE.Vector3().subVectors(p, panStartPosRef.current);
        onCommitPanDelta?.({ x: d.x, y: d.y, z: d.z });

        panRef.current.position.copy(panStartPosRef.current);
      }
    };

    const onObjChange = () => {
      if (!panRef.current) return;
      const p = panRef.current.position;
      const d = new THREE.Vector3().subVectors(p, panStartPosRef.current);
      onLivePanDelta?.({ x: d.x, y: d.y, z: d.z });
    };

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('objectChange', onObjChange);
    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('objectChange', onObjChange);
    };
  }, [onLivePanDelta, onCommitPanDelta]);

  const panCenter = useMemo(() => centroidOfSelected(drawable, selectedIds), [drawable, selectedIds]);

  useEffect(() => {
    if (currentTool !== 'pan') return;
    panStartPosRef.current = new THREE.Vector3(panCenter[0], panCenter[1], panCenter[2]);
    if (panRef.current) {
      panRef.current.position.set(panCenter[0], panCenter[1], panCenter[2]);
    }
  }, [currentTool, panCenter[0], panCenter[1], panCenter[2], selectedIds.join('|')]);

  const showPanGizmo = currentTool === 'pan' && selectedIds.length > 0;

  return (
    <Canvas
      camera={{ position: [6000, 4000, 6000], fov: 50, near: 1, far: 500000 }}
      shadows={!!showShadows}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
      onPointerMissed={() => {
        if (selectable) onSelect?.(null, null);
      }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[8000, 10000, 6000]} intensity={1.0} castShadow={!!showShadows} />

      {showGrid ? <Grid infiniteGrid cellSize={100} sectionSize={1000} fadeDistance={70000} /> : null}

      {showShadows ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400000, 400000]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
      ) : null}

      {showPanGizmo ? (
        <TransformControls ref={tcPanRef} mode="translate" size={1.0}>
          <group ref={panRef} position={panCenter}>
            <axesHelper args={[600]} />
            <mesh>
              <sphereGeometry args={[80, 14, 14]} />
              <meshBasicMaterial color="#111111" />
            </mesh>
          </group>
        </TransformControls>
      ) : null}

      {drawable.map((o) => {
        const selected = selectedIds.includes(o.id);
        const isPrimary = o.id === primaryId;
        const hovered = o.id === hoveredId && !selected;

        const groupPos = o.position ?? [0, MM_BASE / 2, 0];
        const rot = o.rotation ?? [0, 0, 0];

        const fusedGeo = o.type === 'fused' ? fusedGeometryMap.get(o.id) : null;

        if (singleSelection && isPrimary && currentTool === 'select' && selectMode === 'body') {
          return (
            <TransformControls key={o.id} ref={tcMoveRef} mode="translate" size={0.9}>
              <group ref={groupRef} position={groupPos} rotation={rot}>
                <PivotMiniAxes />
                <MeshBody
                  obj={o}
                  selected={selected}
                  hovered={hovered}
                  isPrimary={isPrimary}
                  onSelect={onSelect}
                  onHover={onHover}
                  selectable={selectable}
                  fusedGeometry={fusedGeo}
                  showShadows={showShadows}
                />
              </group>
            </TransformControls>
          );
        }

        if (singleSelection && isPrimary && currentTool === 'select' && selectMode === 'vertex') {
          return (
            <group key={o.id} ref={groupRef} position={groupPos} rotation={rot}>
              <PivotMiniAxes />

              <MeshBody
                obj={o}
                selected={selected}
                hovered={hovered}
                isPrimary={isPrimary}
                onSelect={onSelect}
                onHover={onHover}
                selectable={selectable}
                fusedGeometry={fusedGeo}
                showShadows={showShadows}
              />

              {verticesGroup.map((p, idx) => (
                <SnapDot
                  key={`v_${idx}`}
                  position={[p.x, p.y, p.z]}
                  kind="vtx"
                  onSetPivotHere={() => setPivotAtGroupPoint(p)}
                />
              ))}

              {midpointsGroup.map((p, idx) => (
                <SnapDot
                  key={`m_${idx}`}
                  position={[p.x, p.y, p.z]}
                  kind="mid"
                  onSetPivotHere={() => setPivotAtGroupPoint(p)}
                />
              ))}

              <TransformControls ref={tcPivotRef} mode="translate" size={0.7}>
                <mesh ref={pivotHandleRef} position={[0, 0, 0]}>
                  <sphereGeometry args={[90, 18, 18]} />
                  <meshBasicMaterial color="#ff8a00" depthTest={false} />
                </mesh>
              </TransformControls>
            </group>
          );
        }

        return (
          <group key={o.id} position={groupPos} rotation={rot}>
            <PivotMiniAxes />
            <MeshBody
              obj={o}
              selected={selected}
              hovered={hovered}
              isPrimary={isPrimary}
              onSelect={onSelect}
              onHover={onHover}
              selectable={selectable}
              fusedGeometry={fusedGeo}
              showShadows={showShadows}
            />
          </group>
        );
      })}

      <CustomCameraControls enabled={!isTransforming} zoomSensitivity={zoomSensitivity} />

      {/* ✅ Gizmo用：makeDefaultしない（ここが超重要） */}
      <OrbitControls ref={gizmoControlsRef} enabled={false} enableRotate={false} enablePan={false} enableZoom={false} />

      {/* ✅ 右上軸 */}
      <GizmoHelper alignment="top-right" margin={[90, 90]} controls={gizmoControlsRef}>
        <GizmoViewport axisHeadScale={0.9} labelColor="black" />
      </GizmoHelper>
    </Canvas>
  );
}
