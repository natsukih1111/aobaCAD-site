// file: components/steel/sections.js
'use client';

import * as THREE from 'three';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function rad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 直線→コーナー→直線 の「角」を丸める（簡易フィレット）
 * - p0 -> corner -> p1 の角に対し
 * - cornerの両側に r 分だけ退避して quadraticCurveTo で丸める
 *
 * 注意:
 * - 厳密に円弧rにはならないが、見た目は綺麗に丸くなる
 * - 角が鋭すぎたり r が大きすぎると破綻するので clamp で守る
 */
function filletCorner(shape, p0, corner, p1, r) {
  const v0 = new THREE.Vector2(p0.x - corner.x, p0.y - corner.y);
  const v1 = new THREE.Vector2(p1.x - corner.x, p1.y - corner.y);

  const l0 = v0.length();
  const l1 = v1.length();
  if (l0 < 1e-6 || l1 < 1e-6) {
    shape.lineTo(corner.x, corner.y);
    return;
  }

  const rr = clamp(r, 0, Math.min(l0, l1) * 0.49);
  if (rr <= 0) {
    shape.lineTo(corner.x, corner.y);
    return;
  }

  const u0 = v0.clone().multiplyScalar(1 / l0); // corner->p0 方向
  const u1 = v1.clone().multiplyScalar(1 / l1); // corner->p1 方向

  // 角の両側で退避した点
  const a = new THREE.Vector2(corner.x + u0.x * rr, corner.y + u0.y * rr);
  const b = new THREE.Vector2(corner.x + u1.x * rr, corner.y + u1.y * rr);

  shape.lineTo(a.x, a.y);
  shape.quadraticCurveTo(corner.x, corner.y, b.x, b.y);
}

/**
 * ✅ 角R付き チャンネル（U）
 * - r1: 内R（web×flange の内コーナー）
 * - r2: 外R（外周4角 + フランジ先端の角も r2 で丸める）
 * - openDeg: 図の「開き角」(例 95°) を反映
 *   - web内面(縦) と flange内面 が成す角度を openDeg にする
 *   - openDeg=90 で水平（従来）
 *
 * 2D断面は XY平面、押し出しは Z方向 → 最後に rotateY(90) で「長さがX」
 */
export function buildChannelGeometry({
  H,
  B,
  t1,
  t2,
  r1,
  r2,
  L,
  openDeg = 95,
  curveSegments = 24,
}) {
  H = Math.max(0.001, num(H, 100));
  B = Math.max(0.001, num(B, 50));
  t1 = Math.max(0.001, num(t1, 5));
  t2 = Math.max(0.001, num(t2, 7.5));
  L = Math.max(0.001, num(L, 1000));

  // 開き角の傾き（90→0、95→約0.087）
  const delta = rad(num(openDeg, 95) - 90);
  const m = Math.tan(delta); // flange内面の傾き量（底は -m、天は +m）

  // 安全域
  r2 = clamp(num(r2, 0), 0, Math.min(B, H) * 0.25);

  const innerMax = Math.min(t1, t2, Math.max(0.001, (H - 2 * t2) * 0.45));
  r1 = clamp(num(r1, 0), 0, innerMax);

  // flange内面の「先端側Y」を開き角でずらす
  // 底: xが増えるほど yが下がる（-m）
  // 天: xが増えるほど yが上がる（+m）
  const xInnerStart = t1;            // web内面のx
  const xTip = B;                    // フランジ先端（外形）x
  const dx = Math.max(0, xTip - xInnerStart);

  const yBottomInnerAtWeb = t2;
  const yTopInnerAtWeb = H - t2;

  // 先端での内面Y（開き角反映）
  const yBottomInnerAtTip = yBottomInnerAtWeb - m * dx;
  const yTopInnerAtTip = yTopInnerAtWeb + m * dx;

  // 形状として破綻しないようにクランプ
  const yB = clamp(yBottomInnerAtTip, 0.001, H - 0.001);
  const yT = clamp(yTopInnerAtTip, 0.001, H - 0.001);

  // 2D輪郭点（反時計回り）
  // 外周は矩形ベース、開口側も「外角」を含めて全部 r2 で丸める
  //
  // 外角: (0,0),(B,0),(B,H),(0,H)
  // 先端角: (B, yB) と (B, yT) も r2 で丸める（←ユーザー指摘の尖り対策）
  //
  // 内R r1 は web×flange 内側の2箇所のみ（図のr1）

  const s = new THREE.Shape();

  // まずは「骨格点」を作って、角を filletCorner で順番に丸める
  const P = (x, y) => new THREE.Vector2(x, y);

  // 外周から入って内側へ（CCW）
  const pts = [];

  // 外周 左下→右下（外角B,0）
  pts.push(P(0, 0));       // A0
  pts.push(P(B, 0));       // A1

  // 右側を上へ（途中で底フランジ内面へ折れる角＝先端角）
  pts.push(P(B, yB));      // A2 先端内面への折れ（丸めたい）
  // 底フランジ内面（開き角：web側へ向かう直線にするため、後でt1へ接続）
  pts.push(P(t1 + r1, t2)); // A3 (内R接続用の少し手前)

  // 内R（底）：コーナー点（t1,t2）
  pts.push(P(t1, t2));      // A4 inner corner (r1)
  pts.push(P(t1, H - t2));  // A5 inner corner (r1) 上側
  pts.push(P(t1 + r1, H - t2)); // A6 (内R接続用)

  // 天フランジ内面 → 先端（開き角でyTへ）
  pts.push(P(B, yT));       // A7 先端内面折れ（丸めたい）

  // 右上外角
  pts.push(P(B, H));        // A8
  pts.push(P(0, H));        // A9
  pts.push(P(0, 0));        // A10 (close)

  // --- 描画 ---
  // 開始は左下外角を丸めるために、最初の2点を使って moveTo を少し工夫する
  // ここはシンプルに「左下→右下」方向で開始
  s.moveTo(0 + r2, 0);

  // A0(0,0) の外角r2（左下）
  // 既に (r2,0) から始めてるので、次は (B-r2,0) へ
  s.lineTo(B - r2, 0);
  // A1(B,0) 外角r2（右下外角）
  s.quadraticCurveTo(B, 0, B, 0 + r2);

  // 右側を yB へ上げる（ただし A2 の先端角も丸めるので少し手前へ）
  const yB2 = Math.max(r2, yB - r2);
  s.lineTo(B, yB2);

  // A2(B,yB) 先端角（r2）: 右辺(縦)→底フランジ内面(斜め)
  // 斜め方向の次点（A3）へ向かうので、擬似フィレット
  // corner: (B,yB), p0: (B,yB2), p1: 斜め方向の点（A3）
  filletCorner(
    s,
    P(B, yB2),
    P(B, yB),
    P(t1 + r1, t2),
    r2
  );

  // --- 底フランジ内面（開き角反映） ---
  // 先端内面点(B,yB)から web側の (t1+r1,t2) へ
  // filletCorner の最後がすでに A3方向へ到達してるので、そのまま lineTo
  s.lineTo(t1 + r1, t2);

  // A4 (t1,t2) の内R r1（concave）を近似：quadraticで丸め
  // ここは「水平→垂直」なので簡易でOK
  // (t1+r1,t2) -> corner (t1,t2) -> (t1,t2+r1)
  if (r1 > 0) {
    s.quadraticCurveTo(t1, t2, t1, t2 + r1);
  } else {
    s.lineTo(t1, t2);
  }

  // web内面を上へ（上内Rの手前へ）
  s.lineTo(t1, H - t2 - r1);

  // A5 (t1,H-t2) 内R r1
  if (r1 > 0) {
    s.quadraticCurveTo(t1, H - t2, t1 + r1, H - t2);
  } else {
    s.lineTo(t1, H - t2);
  }

  // --- 天フランジ内面（開き角反映） ---
  s.lineTo(B, yT);

  // A7(B,yT) 先端角（r2）: 天フランジ内面(斜め)→右辺(縦)
  // 上へ向かうので、r2分だけ先に (B, yT + r2) へ行く形にしたい
  // ただし yT+r2 が H-r2 を超えると破綻するので clamp
  const yT2 = Math.min(H - r2, yT + r2);
  filletCorner(
    s,
    P(t1 + r1, H - t2),
    P(B, yT),
    P(B, yT2),
    r2
  );

  // 右辺を上へ（外角の手前）
  s.lineTo(B, H - r2);

  // A8(B,H) 外角r2（右上外角）
  s.quadraticCurveTo(B, H, B - r2, H);

  // 上辺を左へ
  s.lineTo(0 + r2, H);

  // A9(0,H) 外角r2（左上外角）
  s.quadraticCurveTo(0, H, 0, H - r2);

  // 左辺を下へ
  s.lineTo(0, 0 + r2);

  // A0(0,0) 外角r2（左下外角）で閉じる
  s.quadraticCurveTo(0, 0, 0 + r2, 0);

  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: L,
    bevelEnabled: false,
    curveSegments,
    steps: 1,
  });

  // Z押し出し → X長さへ
  geo.rotateY(Math.PI / 2);

  // センタリング
  geo.translate(-L / 2, -H / 2, -B / 2);

  geo.computeVertexNormals();
  return geo;
}

/**
 * ✅ Lアングル：開き角（内角）対応（とりあえず “脚が外へ開く” 方向）
 * - openDeg: 90→直角、95→5°開く
 * - r(未): 今回は角度優先。Rは次で入れる
 */
export function buildAngleGeometry({
  A,
  B,
  t,
  L,
  openDeg = 90,
  curveSegments = 18,
}) {
  A = Math.max(0.001, num(A, 50));
  B = Math.max(0.001, num(B, 50));
  t = Math.max(0.001, num(t, 6));
  L = Math.max(0.001, num(L, 1000));

  const delta = rad(num(openDeg, 90) - 90);
  const m = Math.tan(delta);

  // 内面（Lの内側の直角）を openDeg にするために
  // 水平脚の内面を少し傾ける（簡易）
  // 内面の先端yを動かす
  const yTip = t - m * (B - t); // openDeg>90 で下がる

  const s = new THREE.Shape();

  // 外形
  s.moveTo(0, 0);
  s.lineTo(B, 0);
  s.lineTo(B, t);
  // 内面（水平脚）を傾ける
  s.lineTo(t, clamp(yTip, 0.001, t));
  s.lineTo(t, A);
  s.lineTo(0, A);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: L,
    bevelEnabled: false,
    curveSegments,
    steps: 1,
  });

  geo.rotateY(Math.PI / 2);
  geo.translate(-L / 2, -A / 2, -B / 2);
  geo.computeVertexNormals();
  return geo;
}
