// file: components/sketch2d/snapPoints.js
import * as THREE from 'three';

// BufferGeometry から “ユニーク頂点” を world 座標で取り出す（間引きあり）
export function getWorldVerticesFromMesh(mesh, maxPoints = 3000) {
  if (!mesh?.geometry) return [];
  const geo = mesh.geometry;
  const pos = geo.attributes?.position;
  if (!pos) return [];

  // ワールド変換を反映
  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld;

  const out = [];
  const step = Math.max(1, Math.floor(pos.count / maxPoints));

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    out.push(v.clone());
  }

  // 近い点を軽く統合（誤差 0.1mm 程度）
  const uniq = [];
  const keySet = new Set();
  for (const p of out) {
    const k = `${Math.round(p.x * 10)}_${Math.round(p.y * 10)}_${Math.round(p.z * 10)}`;
    if (keySet.has(k)) continue;
    keySet.add(k);
    uniq.push(p);
  }
  return uniq;
}

// indexed geometry から “ユニーク辺” を抜いて中点を world 座標で返す
export function getWorldEdgeMidpointsFromMesh(mesh, maxEdges = 2000) {
  if (!mesh?.geometry) return [];
  const geo = mesh.geometry;
  const pos = geo.attributes?.position;
  if (!pos) return [];

  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld;

  const idx = geo.index?.array;
  // index 無い場合は三角形を連番とみなす
  const indices = idx ? idx : Array.from({ length: pos.count }, (_, i) => i);

  const edgeSet = new Set();
  const edges = [];

  const addEdge = (a, b) => {
    const i0 = Math.min(a, b);
    const i1 = Math.max(a, b);
    const k = `${i0}_${i1}`;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push([i0, i1]);
  };

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i + 0];
    const b = indices[i + 1];
    const c = indices[i + 2];
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
    if (edges.length > maxEdges) break;
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const out = [];

  for (const [a, b] of edges) {
    v0.fromBufferAttribute(pos, a).applyMatrix4(m);
    v1.fromBufferAttribute(pos, b).applyMatrix4(m);
    mid.copy(v0).add(v1).multiplyScalar(0.5);
    out.push(mid.clone());
  }

  // 軽く間引き
  if (out.length > maxEdges) {
    const step = Math.max(1, Math.floor(out.length / maxEdges));
    return out.filter((_, i) => i % step === 0);
  }
  return out;
}

// sketchEntities（2D平面の点）からスナップ候補を作る（端点/中心/半径点）
export function get2DSketchSnapPoints(entities) {
  const pts = [];
  for (const e of entities ?? []) {
    if (e.type === 'line') {
      if (e.a) pts.push({ kind: 'sketch-end', p2: e.a });
      if (e.b) pts.push({ kind: 'sketch-end', p2: e.b });
      // 中点も欲しいなら
      if (e.a && e.b) pts.push({ kind: 'sketch-mid', p2: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 } });
    }
    if (e.type === 'circle') {
      if (e.c) pts.push({ kind: 'circle-center', p2: e.c });
      // 半径点（右方向）を 1つ出す（見た目/吸着用）
      if (e.c && Number.isFinite(e.r)) pts.push({ kind: 'circle-radius', p2: { x: e.c.x + e.r, y: e.c.y } });
      // 4点欲しければここで増やせる
    }
  }
  return pts;
}
