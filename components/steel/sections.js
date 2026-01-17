// file: components/steel/sections.js
'use client';

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';


function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function qcurve(shape, cx, cy, x, y) {
  shape.quadraticCurveTo(cx, cy, x, y);
}
function lineToIfFar(shape, x, y, eps = 1e-6) {
  const pts = shape.getPoints?.();
  if (pts && pts.length) {
    const last = pts[pts.length - 1];
    const dx = last.x - x;
    const dy = last.y - y;
    if (dx * dx + dy * dy < eps * eps) return;
  }
  shape.lineTo(x, y);
}

/**
 * ✅ earcut安定化：Shapeを点列ポリゴンに作り直す
 */
function rebuildShapeAsCleanPolygon(shape, { segments = 180, eps = 1e-6, colEps = 1e-10 } = {}) {
  let pts = shape.getSpacedPoints(Math.max(60, segments | 0));
  if (!pts || pts.length < 3) return shape;

  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first.distanceToSquared(last) < eps * eps) pts = pts.slice(0, -1);

  const dedup = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = dedup[dedup.length - 1];
    if (!q || p.distanceToSquared(q) >= eps * eps) dedup.push(p);
  }

  const simp = [];
  const n = dedup.length;
  for (let i = 0; i < n; i++) {
    const p0 = dedup[(i - 1 + n) % n];
    const p1 = dedup[i];
    const p2 = dedup[(i + 1) % n];

    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;

    const cross = ax * by - ay * bx;
    const la2 = ax * ax + ay * ay;
    const lb2 = bx * bx + by * by;

    if (la2 < eps * eps || lb2 < eps * eps) continue;
    if (cross * cross < colEps * (la2 * lb2)) continue;

    simp.push(p1);
  }

  if (simp.length < 3) return shape;
  if (THREE.ShapeUtils.isClockWise(simp)) simp.reverse();

  return new THREE.Shape(simp);
}

/**
 * チャンネル断面
 */
export function buildChannelGeometry({
  H,
  B,
  t1,
  t2,
  r1 = 0,
  r2 = 0,
  L,
  openDeg = 95,
  curveSegments = 18,
}) {
  H = Math.max(1, num(H, 100));
  B = Math.max(1, num(B, 50));
  t1 = Math.max(0.1, num(t1, 5));
  t2 = Math.max(0.1, num(t2, 7));
  r1 = Math.max(0, num(r1, 0));
  r2 = Math.max(0, num(r2, 0));
  L = Math.max(1, num(L, 100));

  r1 = clamp(r1, 0, Math.min(B, H) * 0.45);
  r2 = clamp(r2, 0, Math.min(B, H) * 0.45);

  const theta = THREE.MathUtils.degToRad(Math.max(90, num(openDeg, 95)) - 90);
  const k = Math.tan(theta);

  let yBotTip = t2 - k * (B - t1);
  let yTopTip = (H - t2) + k * (B - t1);

  yBotTip = clamp(yBotTip, 0, t2);
  yTopTip = clamp(yTopTip, H - t2, H);

  // y が一致しすぎると破綻しやすいので微調整
  const EPSY = 1e-4;
  if (Math.abs(yBotTip - t2) < EPSY) yBotTip = t2 - EPSY;
  if (Math.abs(yTopTip - (H - t2)) < EPSY) yTopTip = (H - t2) + EPSY;

  yBotTip = clamp(yBotTip, 0, t2);
  yTopTip = clamp(yTopTip, H - t2, H);

  // ✅ ここが今回のポイント：r2 が成立しない規格では “成立する範囲まで自動で縮める”
  // 下：内側縦エッジ長さ = |t2 - yBotTip|
  // 上：内側縦エッジ長さ = |yTopTip - (H - t2)|
  const vLenBot = Math.abs(t2 - yBotTip);
  const vLenTop = Math.abs(yTopTip - (H - t2));
  const r2BotMax = Math.max(0, vLenBot * 0.49);
  const r2TopMax = Math.max(0, vLenTop * 0.49);
  const r2Bot = clamp(r2, 0, r2BotMax);
  const r2Top = clamp(r2, 0, r2TopMax);

  const webBot = new THREE.Vector2(t1, t2);
  const webTop = new THREE.Vector2(t1, H - t2);

  const tipBotInner = new THREE.Vector2(B, yBotTip);
  const tipTopInner = new THREE.Vector2(B, yTopTip);

  const dirBot = new THREE.Vector2(-1, +k).normalize();
  const dirTop = new THREE.Vector2(-1, -k).normalize();

  const xFl = clamp(t1 + r1, t1, B - 1e-6);
  const yFlBot = clamp(t2 - k * (xFl - t1), 0, t2);
  const yFlTop = clamp((H - t2) + k * (xFl - t1), H - t2, H);

  const s = new THREE.Shape();

  // ---------- 外形 ----------
  s.moveTo(0, 0);
  s.lineTo(B, 0);
  s.lineTo(B, t2);

  // ---------- 口元：下 ----------
  if (r2Bot > 1e-6) {
    const fil = filletVerticalToSlanted({
      xV: B,
      r: r2Bot,
      corner: tipBotInner,
      dir: dirBot,
      materialSideY: -1,
    });

    if (fil && fil.yOnVertical <= t2 + 1e-6 && fil.yOnVertical >= -1e-6) {
      lineToIfFar(s, B, clamp(fil.yOnVertical, 0, t2));
      s.absarc(fil.cx, fil.cy, r2Bot, fil.aStart, fil.aEnd, fil.clockwise);
      lineToIfFar(s, xFl, yFlBot);
    } else {
      s.lineTo(B, yBotTip);
      lineToIfFar(s, xFl, yFlBot);
    }
  } else {
    s.lineTo(B, yBotTip);
    lineToIfFar(s, xFl, yFlBot);
  }

  // ---------- 根元：r1（下→ウェブ→上） ----------
  if (r1 > 1e-6) {
    qcurve(s, webBot.x, webBot.y, t1, t2 + r1);
    s.lineTo(t1, H - t2 - r1);
    qcurve(s, webTop.x, webTop.y, xFl, yFlTop);
  } else {
    s.lineTo(t1, t2);
    s.lineTo(t1, H - t2);
    s.lineTo(xFl, yFlTop);
  }

  // ---------- 口元：上 ----------
  if (r2Top > 1e-6) {
    const fil = filletVerticalToSlanted({
      xV: B,
      r: r2Top,
      corner: tipTopInner,
      dir: dirTop,
      materialSideY: +1,
    });

    if (fil && fil.yOnVertical <= H + 1e-6 && fil.yOnVertical >= (H - t2) - 1e-6) {
      s.lineTo(fil.pOnSlanted.x, fil.pOnSlanted.y);
      s.absarc(fil.cx, fil.cy, r2Top, fil.aEnd, fil.aStart, !fil.clockwise);
      s.lineTo(B, H - t2);
    } else {
      s.lineTo(B, yTopTip);
      s.lineTo(B, H - t2);
    }
  } else {
    s.lineTo(B, yTopTip);
    s.lineTo(B, H - t2);
  }

  // ---------- 外形に戻って閉じる ----------
  s.lineTo(B, H);
  s.lineTo(0, H);
  s.lineTo(0, 0);
  s.closePath();

  const stableShape = rebuildShapeAsCleanPolygon(s, {
    segments: Math.max(120, (curveSegments | 0) * 20),
    eps: 1e-6,
    colEps: 1e-10,
  });

  const geo = new THREE.ExtrudeGeometry(stableShape, {
    depth: L,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(6, curveSegments | 0),
  });

  geo.translate(0, 0, -L / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 縦線 x=xV（材料側は左） と 斜線（dir） の “材料側” フィレット
 */
function filletVerticalToSlanted({ xV, r, corner, dir, materialSideY }) {
  if (r <= 1e-6) return null;

  const nL = new THREE.Vector2(-dir.y, dir.x).normalize();
  const nR = nL.clone().multiplyScalar(-1);

  let n = nL;
  if (materialSideY > 0) {
    if (n.y <= 0) n = nR;
  } else {
    if (n.y >= 0) n = nR;
  }

  const xC = xV - r;
  const p0 = corner.clone().add(n.clone().multiplyScalar(r));

  if (Math.abs(dir.x) < 1e-9) return null;
  const t = (xC - p0.x) / dir.x;
  const yC = p0.y + dir.y * t;

  const center = new THREE.Vector2(xC, yC);

  const pV = new THREE.Vector2(xV, yC);
  const pS = center.clone().sub(n.clone().multiplyScalar(r));

  const aV = Math.atan2(pV.y - center.y, pV.x - center.x);
  const aS = Math.atan2(pS.y - center.y, pS.x - center.x);

  const diff = Math.atan2(Math.sin(aS - aV), Math.cos(aS - aV));
  const clockwise = diff < 0;

  return {
    cx: center.x,
    cy: center.y,
    yOnVertical: pV.y,
    pOnSlanted: pS,
    aStart: aV,
    aEnd: aS,
    clockwise,
  };
}

/**
 * アングル（そのまま）
 */
export function buildAngleGeometry({ A, B, t, r1 = 0, r2 = 0, L, curveSegments = 16 }) {
  A = Math.max(1, num(A, 50));
  B = Math.max(1, num(B, 50));
  t = Math.max(0.1, num(t, 6));
  r1 = Math.max(0, num(r1, 0));
  r2 = Math.max(0, num(r2, 0));
  L = Math.max(1, num(L, 100));

  // ---- Rの安全クランプ（破綻防止）----
  const r1Max = Math.max(0, Math.min(t, B - t, A - t) * 0.99);
  const R1 = clamp(r1, 0, r1Max);

  // ✅ r2 は「内側先端」(B,t) と (t,A)
  const r2AtBtMax = Math.max(0, Math.min(t, B - t) * 0.99);
  const r2AtTaMax = Math.max(0, Math.min(t, A - t) * 0.99);
  const R2Bt = clamp(r2, 0, r2AtBtMax);
  const R2Ta = clamp(r2, 0, r2AtTaMax);

  const s = new THREE.Shape();

  // CCW:
  // (0,0) -> (B,0) -> (B,t) -> (t,t) -> (t,A) -> (0,A) -> (0,0)

  s.moveTo(0, 0);
  s.lineTo(B, 0);

  // ---- 角 (B,t) に r2（これは今まで通りでOK）----
  if (R2Bt > 1e-6) {
    // (B, t-R) まで上がる
    s.lineTo(B, t - R2Bt);
    // 中心 (B-R, t-R)、(B,t-R) -> (B-R,t)
    s.absarc(B - R2Bt, t - R2Bt, R2Bt, 0, Math.PI / 2, false);
    // いま (B-R, t)
  } else {
    s.lineTo(B, t);
  }

  // ---- 内側水平：y=t を左へ → 内側根元 (t,t) に r1 ----
  if (R1 > 1e-6) {
    s.lineTo(t + R1, t);
    // 凹R（内側根元）
    s.absarc(t + R1, t + R1, R1, -Math.PI / 2, -Math.PI, true);
    // いま (t, t+R1)
  } else {
    s.lineTo(t, t);
  }

  // ---- 内側垂直：x=t を上へ ----
  // ここで上の r2 を「中心を内側 (t-R, A-R)」にして丸める
  if (R2Ta > 1e-6) {
    // (t, A-R) まで上がる
    s.lineTo(t, A - R2Ta);

    // ✅ 角 (t,A) の正しい丸み（内側に削る）
    // 中心 (t-R, A-R)
    // 接線点: (t, A-R) -> (t-R, A)
    s.absarc(t - R2Ta, A - R2Ta, R2Ta, 0, Math.PI / 2, false);

    // いま (t-R, A)
  } else {
    s.lineTo(t, A);
  }

  // ---- 上辺：y=A を左へ → (0,A) ----
  s.lineTo(0, A);

  // ---- 左辺：x=0 を下へ → (0,0) ----
  s.lineTo(0, 0);
  s.closePath();

  // ✅ earcut安定化（同ファイルに rebuildShapeAsCleanPolygon がある前提）
  const stableShape =
    typeof rebuildShapeAsCleanPolygon === 'function'
      ? rebuildShapeAsCleanPolygon(s, {
          segments: Math.max(120, (curveSegments | 0) * 20),
          eps: 1e-6,
          colEps: 1e-10,
        })
      : s;

  const geo = new THREE.ExtrudeGeometry(stableShape, {
    depth: L,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(6, curveSegments | 0),
  });

  geo.translate(-B / 2, -A / 2, -L / 2);
  geo.computeVertexNormals();
  return geo;
}
// ===== ここから下を追加（丸棒・ガス管）=====

/**
 * 丸棒（ソリッド円柱）
 * - D: 直径（優先）
 * - R: 半径（Dが無い時）
 * - L: 長さ
 */
export function buildRoundBarGeometry({
  D, // diameter
  R, // radius
  L,
  radialSegments = 48,
  heightSegments = 1,
} = {}) {
  const d = num(D, 0);
  const r = Math.max(0.1, num(R, d > 0 ? d / 2 : 10));
  const len = Math.max(0.1, num(L, 100));

  const geo = new THREE.CylinderGeometry(
    r, // top
    r, // bottom
    len,
    Math.max(12, radialSegments | 0),
    Math.max(1, heightSegments | 0),
    false
  );

  // 長さ方向を Z に揃える（CylinderGeometry はY方向が高さ）
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, -len / 2);

  geo.computeVertexNormals();
  return geo;
}

/**
 * ガス管（中空円柱）
 * - D: 外径
 * - t: 肉厚（優先）
 * - d: 内径（tが無い時）
 * - L: 長さ
 *
 * 例:
 *  buildPipeGeometry({ D: 34, t: 3.2, L: 100 })
 *  buildPipeGeometry({ D: 34, d: 27.6, L: 100 })
 */
export function buildPipeGeometry({
  D, // outer diameter
  t, // thickness (preferred)
  d, // inner diameter (fallback)
  L,
  curveSegments = 96,
} = {}) {
  const D0 = Math.max(0.1, num(D, 30));
  const len = Math.max(0.1, num(L, 100));

  const R0 = D0 / 2;

  const t0 = Math.max(0, num(t, 0));
  const d0 = Math.max(0, num(d, 0));

  // 内径決定：tがあれば D-2t、無ければ d を使う
  let innerD = 0;
  if (t0 > 0) innerD = D0 - 2 * t0;
  else innerD = d0;

  // 内径の安全クランプ（負や外径以上を防ぐ）
  innerD = clamp(innerD, 0, D0 - 1e-6);
  const rIn = innerD / 2;

  // 穴が無い（またはほぼ0）なら丸棒として返す
  if (rIn <= 1e-6) {
    return buildRoundBarGeometry({ R: R0, L: len, radialSegments: 64 });
  }

  // 断面：外円 - 内円（穴）
  const outer = new THREE.Shape();
  outer.absarc(0, 0, R0, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  outer.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: len,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(24, curveSegments | 0),
  });

  // Z中心合わせ（他と同じ）
  geo.translate(0, 0, -len / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * FB（フラットバー）
 * - H: 幅
 * - t: 板厚
 * - L: 長さ
 * 形状：Box (H × t × L)
 */
export function buildFlatBarGeometry({ H, t, L } = {}) {
  H = Math.max(0.1, num(H, 25));
  t = Math.max(0.1, num(t, 3));
  L = Math.max(0.1, num(L, 100));

  // BoxGeometry は中心が原点
  const geo = new THREE.BoxGeometry(H, t, L);

  // 今までの鋼材と同じく「長さ方向Z」「Z中心」を合わせる
  // Boxは元から中心なので、Zだけ -L/2 して「前後中心」を揃える流儀に統一
  geo.translate(0, 0, -L / 2);

  geo.computeVertexNormals();
  return geo;
}
/**
 * 角パイプ（角丸）
 * - H: 高さ
 * - B: 幅
 * - t: 板厚
 * - L: 長さ
 * - rOuter: 外角R（未指定なら t をベースに自動）
 * - rInner: 内角R（未指定なら max(0, rOuter - t)）
 *
 * 形状：外側の角丸四角形 - 内側の角丸四角形（hole）
 */
export function buildSquarePipeGeometry({
  H,
  B,
  t,
  L,
  rOuter = null,
  rInner = null,
  curveSegments = 24,
} = {}) {
  H = Math.max(1, num(H, 50));
  B = Math.max(1, num(B, 50));
  t = Math.max(0.1, num(t, 2.3));
  L = Math.max(1, num(L, 100));

  // ✅ 自動R（外角は板厚の1.5倍を基準）
  const autoOuter = Math.max(0, t * 1.5);
  let RO = rOuter == null ? autoOuter : Math.max(0, num(rOuter, autoOuter));
  RO = clamp(RO, 0, Math.min(B, H) * 0.49);

  // 内側
  const Bi = Math.max(0.1, B - 2 * t);
  const Hi = Math.max(0.1, H - 2 * t);

  const autoInner = Math.max(0, RO - t);
  let RI = rInner == null ? autoInner : Math.max(0, num(rInner, autoInner));
  RI = clamp(RI, 0, Math.min(Bi, Hi) * 0.49);

  // 角丸四角形を作る（左下基準 + オフセット対応）
  function roundedRectShape(w, h, r, ox = 0, oy = 0) {
    const s = new THREE.Shape();
    const rr = clamp(r, 0, Math.min(w, h) * 0.49);

    // 左下(ox,oy)基準で反時計回り
    s.moveTo(ox + rr, oy);
    s.lineTo(ox + w - rr, oy);
    if (rr > 1e-6) s.absarc(ox + w - rr, oy + rr, rr, -Math.PI / 2, 0, false);

    s.lineTo(ox + w, oy + h - rr);
    if (rr > 1e-6) s.absarc(ox + w - rr, oy + h - rr, rr, 0, Math.PI / 2, false);

    s.lineTo(ox + rr, oy + h);
    if (rr > 1e-6) s.absarc(ox + rr, oy + h - rr, rr, Math.PI / 2, Math.PI, false);

    s.lineTo(ox, oy + rr);
    if (rr > 1e-6) s.absarc(ox + rr, oy + rr, rr, Math.PI, (3 * Math.PI) / 2, false);

    s.closePath();
    return s;
  }

  // 外形（0,0 基準）
  const outer = roundedRectShape(B, H, RO, 0, 0);

  // 穴（t,t オフセットで最初から作る） ✅
  const hole = roundedRectShape(Bi, Hi, RI, t, t);
  outer.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: L,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(8, curveSegments | 0),
  });

  // 中心合わせ（XY中心、Zは -L/2）
  geo.translate(-B / 2, -H / 2, -L / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * H鋼（Iビーム）
 * パラメータ:
 * - H: 全高
 * - B: フランジ幅
 * - t1: ウェブ厚
 * - t2: フランジ厚
 * - r: 内側フィレットR（4箇所）
 * - L: 長さ
 *
 * 座標系（左下外角が (0,0)）:
 * 外角は丸めない。内側の根元Rだけ丸める。
 */
export function buildHBeamGeometry({ H, B, t1, t2, r = 0, L, curveSegments = 18 } = {}) {
  H = Math.max(1, num(H, 100));
  B = Math.max(1, num(B, 100));
  t1 = Math.max(0.1, num(t1, 6));
  t2 = Math.max(0.1, num(t2, 8));
  r = Math.max(0, num(r, 0));
  L = Math.max(1, num(L, 100));

  // 破綻防止：r は内側空間に収まる範囲
  const innerW = Math.max(0.1, (B - t1) / 2);
  const innerH = Math.max(0.1, (H - 2 * t2) / 2);
  const rMax = Math.max(0, Math.min(innerW, innerH) * 0.99);
  const R = clamp(r, 0, rMax);

  const xL = (B - t1) / 2;      // ウェブ左面x
  const xR = (B + t1) / 2;      // ウェブ右面x
  const yBotFl = t2;           // 下フランジ上面y
  const yTopFl = H - t2;       // 上フランジ下面y

  const s = new THREE.Shape();

  // 外形を反時計回りで一周
  s.moveTo(0, 0);
  s.lineTo(B, 0);
  s.lineTo(B, t2);
  s.lineTo(xR, t2);

  // ---- 下右内角（フランジ内→ウェブ外） R ----
  if (R > 1e-6) {
    // フランジ内側水平を左へ (xR+R, t2) まで
    s.lineTo(xR + R, t2);
    // 中心 (xR+R, t2+R) で 270°→180°（下→左） = 内側にえぐる
    s.absarc(xR + R, t2 + R, R, -Math.PI / 2, -Math.PI, true);
    // いま (xR, t2+R)
  } else {
    s.lineTo(xR, t2);
  }

  // ウェブ右面を上へ（上フランジ手前まで）
  s.lineTo(xR, yTopFl - R);

  // ---- 上右内角 R ----
  if (R > 1e-6) {
    // 中心 (xR+R, yTopFl-R) で 180°→90°（左→上） = 内側にえぐる
    s.absarc(xR + R, yTopFl - R, R, Math.PI, Math.PI / 2, true);
    // いま (xR+R, yTopFl)
    s.lineTo(B, yTopFl);
  } else {
    s.lineTo(xR, yTopFl);
    s.lineTo(B, yTopFl);
  }

  // 上フランジ外形
  s.lineTo(B, H);
  s.lineTo(0, H);
  s.lineTo(0, yTopFl);
  s.lineTo(xL, yTopFl);

  // ---- 上左内角 R ----
  if (R > 1e-6) {
    s.lineTo(xL - R, yTopFl);
    // 中心 (xL-R, yTopFl-R) で 90°→0°（上→右） = 内側にえぐる
    s.absarc(xL - R, yTopFl - R, R, Math.PI / 2, 0, true);
    // いま (xL, yTopFl-R)
  } else {
    s.lineTo(xL, yTopFl);
  }

  // ウェブ左面を下へ（下フランジ手前まで）
  s.lineTo(xL, t2 + R);

  // ---- 下左内角 R ----
  if (R > 1e-6) {
    // 中心 (xL-R, t2+R) で 0°→-90°（右→下）
    s.absarc(xL - R, t2 + R, R, 0, -Math.PI / 2, true);
    // いま (xL-R, t2)
    s.lineTo(0, t2);
  } else {
    s.lineTo(xL, t2);
    s.lineTo(0, t2);
  }

  // 下フランジ外形に戻って閉じる
  s.lineTo(0, 0);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: L,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(6, curveSegments | 0),
  });

  // 中心合わせ（XY中心・Z中心）
  geo.translate(-B / 2, -H / 2, -L / 2);
  geo.computeVertexNormals();
  return geo;
}
class Arc3DCurve extends THREE.Curve {
  constructor(radius, startRad, endRad) {
    super();
    this.radius = radius;
    this.startRad = startRad;
    this.endRad = endRad;
  }
  getPoint(t) {
    const a = this.startRad + (this.endRad - this.startRad) * t;
    const x = this.radius * Math.cos(a);
    const z = this.radius * Math.sin(a);
    return new THREE.Vector3(x, 0, z);
  }
}

/**
 * ガス管用 ロングエルボ（45/90）
 * - D: 外径
 * - t: 板厚
 * - angleDeg: 45 or 90
 * - R: 中心半径（中心から端面まで、JIS表の H/F をそのまま入れる）
 */
export function buildPipeElbowGeometry({
  D,
  t,
  angleDeg = 90,
  R,
  curveSegments = 128,
} = {}) {
  D = Math.max(1, num(D, 34));
  t = Math.max(0.1, num(t, 3.2));
  angleDeg = Number(angleDeg);
  const ang = THREE.MathUtils.degToRad(angleDeg);

  const outerR = D / 2;
  const innerR = Math.max(0.1, outerR - t);

  // R（中心半径）
  let radius = Math.max(1, num(R, 0));
  if (!Number.isFinite(radius) || radius <= 0) {
    // フォールバック：ロングエルボっぽい値（雑）
    radius = Math.max(10, outerR * 3.0);
  }

  // 断面（リング）
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  // hole は逆回り（clockwise=true）
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // 押し出しパス（XZ平面の円弧）
  // 90°なら (R,0) → (0,R) になる
  const path = new Arc3DCurve(radius, 0, ang);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: Math.max(12, Math.round((curveSegments | 0) * (angleDeg / 90))),
    bevelEnabled: false,
    curveSegments: Math.max(8, curveSegments | 0),
    extrudePath: path,
  });

  // 中心合わせ（表示が楽）
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb) {
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }
  geo.computeVertexNormals();
  return geo;
}


function makeDiamondHolePathCW(cx, cy, dx, dy) {
  // 穴は outer と逆向き（CW）にする
  const pts = [
    new THREE.Vector2(cx, cy + dy / 2),
    new THREE.Vector2(cx - dx / 2, cy),
    new THREE.Vector2(cx, cy - dy / 2),
    new THREE.Vector2(cx + dx / 2, cy),
  ];

  // 念のためCW強制（clockwise true になってなければ reverse）
  if (!THREE.ShapeUtils.isClockWise(pts)) pts.reverse();

  const p = new THREE.Path();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
}

/**
 * エキスパンドメタル（見た目用・軽量）
 * - SW/LW: ピッチ（見た目用）
 * - T: 板厚（見た目用、重量はExcel側を使う前提）
 * - W: ストランド幅（穴サイズを狭める）
 * - width/height: 板の縦横サイズ（mm） ✅追加
 *
 * ✅重要：ここでは rebuildShapeAsCleanPolygon を使わない（holes が消えるため）
 */
export function buildExpandedMetalGeometry({
  SW,
  LW,
  T,
  W,
  width = 1200,   // ✅ 板の横幅
  height = 600,   // ✅ 板の縦幅
  curveSegments = 8,
} = {}) {
  SW = Math.max(1, num(SW, 12));
  LW = Math.max(1, num(LW, 30));
  T = Math.max(0.2, num(T, 2.3));
  W = Math.max(0.1, num(W, 2.6));

  width = Math.max(10, num(width, 1200));
  height = Math.max(10, num(height, 600));

  // 穴（ダイヤ）の対角線サイズ：ピッチ - ストランド幅（見た目用）
  const holeLW = Math.max(0.5, LW - W);
  const holeSW = Math.max(0.5, SW - W);

  const outerPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(width, 0),
    new THREE.Vector2(width, height),
    new THREE.Vector2(0, height),
  ];
  // outer は CCW にする
  if (THREE.ShapeUtils.isClockWise(outerPts)) outerPts.reverse();

  const outer = new THREE.Shape(outerPts);

  // 並べる個数（ピッチから自動計算）
  const nx = Math.max(1, Math.floor(width / LW));
  const ny = Math.max(1, Math.floor(height / SW));

  // ダイヤ穴を千鳥配置
  for (let iy = 0; iy < ny; iy++) {
    const y = (iy + 0.5) * SW;
    const xOffset = (iy % 2) * (LW / 2);

    for (let ix = 0; ix < nx; ix++) {
      const x = (ix + 0.5) * LW + xOffset;

      // 外形からはみ出す穴はスキップ
      if (x - holeLW / 2 < 0) continue;
      if (x + holeLW / 2 > width) continue;
      if (y - holeSW / 2 < 0) continue;
      if (y + holeSW / 2 > height) continue;

      const hole = makeDiamondHolePathCW(x, y, holeLW, holeSW);
      outer.holes.push(hole);
    }
  }

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: T,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(6, curveSegments | 0),
  });

  // 中心合わせ
  geo.translate(-width / 2, -height / 2, -T / 2);
  geo.computeVertexNormals();
  return geo;
}

// file: components/steel/sections.js
// ↓ 一番下にそのまま追加

/**
 * 縞板（見た目用）
 * - t: 板厚（Excelの板厚）
 * - width/height: 板の縦横サイズ（mm）
 * - pitch: 縞のピッチ（見た目用）
 * - ribHeight: 縞の高さ（見た目用）
 * - ribWidth: 縞の太さ（見た目用）
 *
 * ✅ 軽量：板 + 縞(細い箱) を合体（merge）して1つのジオメトリにする
 */
// file: components/steel/sections.js
// ✅ buildCheckeredPlateGeometry をこれに置き換え

export function buildCheckeredPlateGeometry({
  t,
  width = 1200,
  height = 600,

  // 縞板っぽい突起（涙滴）の見た目用パラメータ
  pitchX = 60,       // 横方向ピッチ
  pitchZ = 60,       // 縦方向ピッチ
  bumpLen = 38,      // 突起の長さ（涙滴の長手）
  bumpWid = 14,      // 突起の幅
  bumpH = 1.2,       // 突起高さ
  rotDeg = 25,       // 突起の傾き（縞板っぽい角度）
} = {}) {
  t = Math.max(0.2, num(t, 3.2));
  width = Math.max(10, num(width, 1200));
  height = Math.max(10, num(height, 600));

  pitchX = Math.max(10, num(pitchX, 60));
  pitchZ = Math.max(10, num(pitchZ, 60));
  bumpLen = Math.max(5, num(bumpLen, 38));
  bumpWid = Math.max(3, num(bumpWid, 14));
  bumpH = Math.max(0.2, num(bumpH, 1.2));
  rotDeg = num(rotDeg, 25);

  // 板本体（Yが厚み）
  const base = new THREE.BoxGeometry(width, t, height);

  // 突起は板の上面に乗せる
  const topY = t / 2 + bumpH / 2;

  // ✅ “涙滴っぽい” を軽く作る：
  // 角丸長方形に近い形＝薄い「カプセル（capsule）」を使う
  // three の CapsuleGeometry は重いことがあるので、
  // Cylinder + 両端のSphere を merge して簡易カプセルにする
  const r = bumpWid / 2;
  const cylLen = Math.max(0.1, bumpLen - bumpWid);

  const cyl = new THREE.CylinderGeometry(r, r, cylLen, 18, 1, false);
  // Cylinder はY軸が高さなので、Z軸方向に寝かせる
  cyl.rotateX(Math.PI / 2);

  const sphA = new THREE.SphereGeometry(r, 18, 10);
  const sphB = new THREE.SphereGeometry(r, 18, 10);

  // 端球をZ方向に配置（寝かせた後なのでZが長手）
  sphA.translate(0, 0, +cylLen / 2);
  sphB.translate(0, 0, -cylLen / 2);

  const bump = mergeGeometries([cyl, sphA, sphB], false);

  // 突起を少しつぶして“平たい涙滴”にする（縞板っぽく）
  bump.scale(1, bumpH / (2 * r), 1); // Yだけ低くする（半径2rを基準に）

  // 角度
  const rot = THREE.MathUtils.degToRad(rotDeg);

  const pieces = [base];

  // 並べる数
  const nx = Math.max(1, Math.floor(width / pitchX));
  const nz = Math.max(1, Math.floor(height / pitchZ));

  // 端からの余白（半分）
  const x0 = -width / 2 + pitchX / 2;
  const z0 = -height / 2 + pitchZ / 2;

  // ✅ 縞板っぽい「交互」配置：
  // 偶数行は右上がり、奇数行は左上がり＋半ピッチずらし
  for (let iz = 0; iz < nz; iz++) {
    const z = z0 + iz * pitchZ;
    const shift = (iz % 2) * (pitchX / 2);

    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * pitchX + shift;

      // 板からはみ出るのを少し抑える（ざっくり）
      if (x < -width / 2 + bumpLen / 2) continue;
      if (x > +width / 2 - bumpLen / 2) continue;
      if (z < -height / 2 + bumpLen / 2) continue;
      if (z > +height / 2 - bumpLen / 2) continue;

      const g = bump.clone();

      // 回転：行で反転
      g.rotateY(iz % 2 === 0 ? rot : -rot);

      // 位置
      g.translate(x, topY, z);

      pieces.push(g);
    }
  }

  const merged = mergeGeometries(pieces, false);

  // 中心合わせ（念のため）
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  if (bb) {
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    merged.translate(-cx, -cy, -cz);
  }

  merged.computeVertexNormals();
  return merged;
}

