// file: lib/units.js
export const MM_TO_UNIT = 0.001; // 1 unit = 1000mm (=1m)
export const toScene = (mm) => (Number(mm) || 0) * MM_TO_UNIT;
export const toMM = (u) => (Number(u) || 0) / MM_TO_UNIT;

export function v3ToScene(mmVec3) {
  const p = mmVec3 ?? [0, 0, 0];
  return [toScene(p[0] ?? 0), toScene(p[1] ?? 0), toScene(p[2] ?? 0)];
}
export function v3ToMM(sceneVec3) {
  const p = sceneVec3 ?? [0, 0, 0];
  return [toMM(p[0] ?? 0), toMM(p[1] ?? 0), toMM(p[2] ?? 0)];
}
