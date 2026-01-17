// file: components/sketch2d/sketchFrame.js
'use client';

import * as THREE from 'three';

function pickStableUp(n) {
  // 法線に平行に近いUpを避ける
  const upA = new THREE.Vector3(0, 1, 0);
  const upB = new THREE.Vector3(1, 0, 0);
  const d = Math.abs(n.dot(upA));
  return d > 0.85 ? upB : upA;
}

/**
 * face pick から 2Dスケッチ用の座標系（origin,u,v,normal）を作る
 * - origin: 面上の点（クリック点）
 * - normal: ワールド法線
 * - u,v: 面上の直交2軸（右手系）
 */
export function buildSketchFrame(worldPoint, worldNormal) {
  const n = worldNormal.clone().normalize();
  const up = pickStableUp(n);

  const u = new THREE.Vector3().crossVectors(up, n).normalize(); // up x n
  const v = new THREE.Vector3().crossVectors(n, u).normalize();  // n x u

  return {
    origin: [worldPoint.x, worldPoint.y, worldPoint.z],
    normal: [n.x, n.y, n.z],
    u: [u.x, u.y, u.z],
    v: [v.x, v.y, v.z],
  };
}

export function worldToSketch2D(frame, worldPoint) {
  const o = new THREE.Vector3(frame.origin[0], frame.origin[1], frame.origin[2]);
  const u = new THREE.Vector3(frame.u[0], frame.u[1], frame.u[2]);
  const v = new THREE.Vector3(frame.v[0], frame.v[1], frame.v[2]);

  const p = worldPoint.clone().sub(o);
  return {
    x: p.dot(u),
    y: p.dot(v),
  };
}

export function sketch2DToWorld(frame, x, y) {
  const o = new THREE.Vector3(frame.origin[0], frame.origin[1], frame.origin[2]);
  const u = new THREE.Vector3(frame.u[0], frame.u[1], frame.u[2]);
  const v = new THREE.Vector3(frame.v[0], frame.v[1], frame.v[2]);

  return o.clone().add(u.multiplyScalar(x)).add(v.multiplyScalar(y));
}
