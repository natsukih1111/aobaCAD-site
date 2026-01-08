// file: app/library/page.js
'use client';

import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { buildChannelGeometry, buildAngleGeometry } from '@/components/steel/sections';

const CHANNELS = [
  { name: 'U75', H: 75, B: 40, t1: 5, t2: 7, r1: 8, r2: 4 },
  { name: 'U100x50', H: 100, B: 50, t1: 5, t2: 7.5, r1: 8, r2: 4 },
  { name: 'U125x65', H: 125, B: 65, t1: 6, t2: 8, r1: 8, r2: 4 },
  { name: 'U150x75x6.5', H: 150, B: 75, t1: 6.5, t2: 10, r1: 8, r2: 5 },
  { name: 'U150x75x9', H: 150, B: 75, t1: 9, t2: 12.5, r1: 10, r2: 7.5 },
  { name: 'U180x75x7', H: 180, B: 75, t1: 7, t2: 10.5, r1: 15, r2: 5.5 },
  { name: 'U200x80x7.5', H: 200, B: 80, t1: 7.5, t2: 11, r1: 11, r2: 6 },
  { name: 'U200x90x8', H: 200, B: 90, t1: 8, t2: 13.5, r1: 12, r2: 7 },
  { name: 'U250x90x9', H: 250, B: 90, t1: 9, t2: 13, r1: 14, r2: 7 },
  { name: 'U300x90x9', H: 300, B: 90, t1: 9, t2: 13, r1: 14, r2: 7 },
];

const ANGLES = [
  { name: 'L50x50x6', A: 50, B: 50, t: 6 },
  { name: 'L75x75x9', A: 75, B: 75, t: 9 },
];

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function PreviewMesh({ geo }) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#bfbfbf',
        metalness: 0.1,
        roughness: 0.7,
      }),
    []
  );

  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

export default function LibraryPage() {
  const [kind, setKind] = useState('channel');
  const [name, setName] = useState(CHANNELS[0]?.name ?? '');
  const [length, setLength] = useState(6000);

  // ✅ 開き角
  const [openDeg, setOpenDeg] = useState(95);

  const list = kind === 'channel' ? CHANNELS : ANGLES;

  const spec = useMemo(() => {
    return list.find((x) => x.name === name) ?? list[0] ?? null;
  }, [list, name]);

  const geo = useMemo(() => {
    if (!spec) return new THREE.BoxGeometry(1000, 1000, 1000);
    const L = Math.max(1, num(length, 6000));

    if (kind === 'channel') {
      return buildChannelGeometry({
        H: spec.H,
        B: spec.B,
        t1: spec.t1,
        t2: spec.t2,
        r1: spec.r1,
        r2: spec.r2,
        L,
        openDeg,
        curveSegments: 28,
      });
    }

    return buildAngleGeometry({
      A: spec.A,
      B: spec.B,
      t: spec.t,
      L,
      openDeg,
      curveSegments: 18,
    });
  }, [kind, spec, length, openDeg]);

  const Hpreview = kind === 'channel' ? (spec?.H ?? 100) : (spec?.A ?? 50);

  return (
    <div className="h-[calc(100vh-64px)] p-4 flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className="text-xs text-gray-500 mb-1">種類</div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded border px-3 py-1 text-sm ${
                kind === 'channel' ? 'bg-orange-500 text-white border-orange-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setKind('channel');
                setName(CHANNELS[0]?.name ?? '');
              }}
            >
              チャンネル
            </button>
            <button
              type="button"
              className={`rounded border px-3 py-1 text-sm ${
                kind === 'angle' ? 'bg-orange-500 text-white border-orange-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setKind('angle');
                setName(ANGLES[0]?.name ?? '');
              }}
            >
              Lアングル
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">規格</div>
          <select
            className="rounded border px-3 py-1 text-sm min-w-[220px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          >
            {list.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">長さ L (mm)</div>
          <input
            className="rounded border px-3 py-1 text-sm w-[160px]"
            type="number"
            step="1"
            value={length}
            onChange={(e) => setLength(num(e.target.value, 6000))}
          />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">開き角 (deg)</div>
          <input
            className="rounded border px-3 py-1 text-sm w-[120px]"
            type="number"
            step="0.1"
            value={openDeg}
            onChange={(e) => setOpenDeg(num(e.target.value, 95))}
          />
          <div className="text-[11px] text-gray-500 mt-1">図の 95° をここで調整</div>
        </div>

        <div className="text-xs text-gray-600 leading-relaxed">
          {kind === 'channel' && spec ? (
            <div>
              <div className="font-semibold">断面パラメータ</div>
              <div>
                H={spec.H} / B={spec.B} / t1={spec.t1} / t2={spec.t2} / r1={spec.r1} / r2={spec.r2}
              </div>
              <div className="text-[11px] text-gray-500">
                ※ r2 は「外周4角 + 先端の折れ角(2箇所)」も丸める（尖り対策）
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-xl border overflow-hidden">
        <Canvas
          camera={{ position: [8000, 5000, 8000], fov: 50, near: 1, far: 500000 }}
          shadows
          onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[8000, 10000, 6000]} intensity={1.0} castShadow />

          <Grid infiniteGrid cellSize={100} sectionSize={1000} fadeDistance={70000} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[400000, 400000]} />
            <shadowMaterial opacity={0.18} />
          </mesh>

          <group position={[0, Hpreview / 2, 0]}>
            <PreviewMesh geo={geo} />
          </group>

          <OrbitControls enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>

      <div className="text-[11px] text-gray-500">
        断面完成を優先 → 後で editor にそのまま移植する。
      </div>
    </div>
  );
}
