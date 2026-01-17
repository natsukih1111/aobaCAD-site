// file: app/library/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildChannelGeometry,
  buildAngleGeometry,
  buildRoundBarGeometry,
  buildPipeGeometry,
  buildFlatBarGeometry,
  buildSquarePipeGeometry,
  buildHBeamGeometry,
  buildPipeElbowGeometry,
  buildExpandedMetalGeometry,
  buildCheckeredPlateGeometry,
} from '@/components/steel/sections';
import { fetchSteelCatalog } from '@/components/steel/steelCatalog';
import { getLongElbowDimsByOD } from '@/components/steel/elbowLongJIS';
import { getExpandedLookPreset } from '@/components/steel/expandedLooks';

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
  const [mounted, setMounted] = useState(false);

  const [kind, setKind] = useState('channel'); // ... + expand + checker
  const [length, setLength] = useState(100);

  // ✅ 板系（エキスパンド/縞板）用：縦横サイズ
  const [plateW, setPlateW] = useState(1200);
  const [plateH, setPlateH] = useState(600);

  const [catalog, setCatalog] = useState({
    channels: [],
    angles: [],
    pipes: [],
    roundBars: [],
    flatBars: [],
    squarePipes: [],
    hBeams: [],
    expands: [],
    checkeredPlates: [],
  });

  const [name, setName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    fetchSteelCatalog()
      .then((c) => {
        if (!alive) return;
        setCatalog({
          channels: Array.isArray(c.channels) ? c.channels : [],
          angles: Array.isArray(c.angles) ? c.angles : [],
          pipes: Array.isArray(c.pipes) ? c.pipes : [],
          roundBars: Array.isArray(c.roundBars) ? c.roundBars : [],
          flatBars: Array.isArray(c.flatBars) ? c.flatBars : [],
          squarePipes: Array.isArray(c.squarePipes) ? c.squarePipes : [],
          hBeams: Array.isArray(c.hBeams) ? c.hBeams : [],
          expands: Array.isArray(c.expands) ? c.expands : [],
          checkeredPlates: Array.isArray(c.checkeredPlates) ? c.checkeredPlates : [],
        });
        setMeta(c._meta ?? null);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setCatalog({
          channels: [],
          angles: [],
          pipes: [],
          roundBars: [],
          flatBars: [],
          squarePipes: [],
          hBeams: [],
          expands: [],
          checkeredPlates: [],
        });
        setMeta(null);
        setLoadError(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const isPlateKind = kind === 'expand' || kind === 'checker';

  const list = useMemo(() => {
    if (kind === 'channel') return catalog.channels;
    if (kind === 'angle') return catalog.angles;
    if (kind === 'roundbar') return catalog.roundBars;
    if (kind === 'pipe') return catalog.pipes;
    if (kind === 'fb') return catalog.flatBars;
    if (kind === 'sqpipe') return catalog.squarePipes;
    if (kind === 'hbeam') return catalog.hBeams;

    if (kind === 'elbow90' || kind === 'elbow45') return catalog.pipes;

    if (kind === 'expand') return catalog.expands;
    if (kind === 'checker') return catalog.checkeredPlates;

    return catalog.channels;
  }, [kind, catalog]);

  useEffect(() => {
    if (!list.length) return;
    if (name && list.some((x) => x.name === name)) return;
    setName(list[0].name);
  }, [list, name]);

  const spec = useMemo(() => list.find((x) => x.name === name) ?? list[0] ?? null, [list, name]);

  const geo = useMemo(() => {
    if (!spec) return new THREE.BoxGeometry(1000, 1000, 1000);
    const L = Math.max(1, num(length, 100));

    if (kind === 'channel') {
      return buildChannelGeometry({
        H: spec.H,
        B: spec.B,
        t1: spec.t1,
        t2: spec.t2,
        r1: spec.r1 ?? 0,
        r2: spec.r2 ?? 0,
        L,
        openDeg: 95,
        curveSegments: 28,
      });
    }

    if (kind === 'angle') {
      return buildAngleGeometry({
        A: spec.A,
        B: spec.B,
        t: spec.t,
        r1: spec.r1 ?? 0,
        r2: spec.r2 ?? 0,
        L,
        curveSegments: 18,
      });
    }

    if (kind === 'roundbar') {
      return buildRoundBarGeometry({ D: spec.D, L, radialSegments: 56 });
    }

    if (kind === 'pipe') {
      return buildPipeGeometry({ D: spec.D, t: spec.t, L, curveSegments: 96 });
    }

    if (kind === 'fb') {
      return buildFlatBarGeometry({ H: spec.H, t: spec.t, L });
    }

    if (kind === 'sqpipe') {
      return buildSquarePipeGeometry({
        H: spec.H,
        B: spec.B,
        t: spec.t,
        L,
        curveSegments: 28,
      });
    }

    if (kind === 'hbeam') {
      return buildHBeamGeometry({
        H: spec.H,
        B: spec.B,
        t1: spec.t1,
        t2: spec.t2,
        r: spec.r ?? 0,
        L,
        curveSegments: 24,
      });
    }

    if (kind === 'elbow90' || kind === 'elbow45') {
      const dims = getLongElbowDimsByOD(spec.D);
      const angleDeg = kind === 'elbow45' ? 45 : 90;
      const R = dims ? (angleDeg === 90 ? dims.F : dims.H) : 0;

      return buildPipeElbowGeometry({
        D: spec.D,
        t: spec.t,
        angleDeg,
        R,
        curveSegments: 128,
      });
    }

    if (kind === 'expand') {
      const p = getExpandedLookPreset(spec.name);
      return buildExpandedMetalGeometry({
        SW: p.SW,
        LW: p.LW,
        T: p.T, // 見た目用
        W: p.W,
        width: Math.max(10, num(plateW, 1200)),
        height: Math.max(10, num(plateH, 600)),
        curveSegments: 8,
      });
    }

    // ✅ 縞板（Excelの板厚 t を使う、見た目だけ縞）
    if (kind === 'checker') {
      return buildCheckeredPlateGeometry({
  t: spec.t ?? 3.2,
  width: Math.max(10, num(plateW, 1200)),
  height: Math.max(10, num(plateH, 600)),
  pitchX: 65,
  pitchZ: 55,
  bumpLen: 40,
  bumpWid: 14,
  bumpH: Math.max(0.6, (spec.t ?? 3.2) * 0.35),
  rotDeg: 25,
});

    }

    return new THREE.BoxGeometry(1000, 1000, 1000);
  }, [kind, spec, length, plateW, plateH]);

  const Hpreview = useMemo(() => {
    if (!spec) return 100;
    if (kind === 'channel') return spec.H ?? 100;
    if (kind === 'angle') return spec.A ?? 50;
    if (kind === 'roundbar') return spec.D ?? 20;
    if (kind === 'pipe') return spec.D ?? 30;
    if (kind === 'fb') return spec.H ?? 50;
    if (kind === 'sqpipe') return spec.H ?? 60;
    if (kind === 'hbeam') return spec.H ?? 100;
    if (kind === 'elbow90' || kind === 'elbow45') return spec.D ?? 30;
    if (kind === 'expand' || kind === 'checker') return Math.min(200, Math.max(40, plateH / 10));
    return 100;
  }, [kind, spec, plateH]);

  const kindLabel = useMemo(() => {
    if (kind === 'channel') return 'チャンネル';
    if (kind === 'angle') return 'Lアングル';
    if (kind === 'roundbar') return '丸鋼（丸棒）';
    if (kind === 'pipe') return 'ガス管';
    if (kind === 'elbow90') return 'ロングエルボ 90°（ガス管）';
    if (kind === 'elbow45') return 'ロングエルボ 45°（ガス管）';
    if (kind === 'fb') return 'FB（フラットバー）';
    if (kind === 'sqpipe') return '角パイプ';
    if (kind === 'hbeam') return 'H鋼';
    if (kind === 'expand') return 'エキスパンドメタル';
    return '縞板';
  }, [kind]);

  if (!mounted) return null;

  return (
    <div className="h-[calc(100vh-64px)] p-4 flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className="text-xs text-gray-500 mb-1">種類</div>
          <select
            className="rounded border px-3 py-1 text-sm min-w-[240px]"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setName('');
            }}
          >
            <option value="channel">チャンネル</option>
            <option value="angle">Lアングル</option>
            <option value="roundbar">丸鋼（丸棒）</option>
            <option value="pipe">ガス管</option>
            <option value="elbow90">ロングエルボ 90°（ガス管）</option>
            <option value="elbow45">ロングエルボ 45°（ガス管）</option>
            <option value="fb">FB（フラットバー）</option>
            <option value="sqpipe">角パイプ</option>
            <option value="hbeam">H鋼</option>
            <option value="expand">エキスパンドメタル</option>
            <option value="checker">縞板</option>
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">規格</div>
          <select
            className="rounded border px-3 py-1 text-sm min-w-[220px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!list.length}
          >
            {list.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ 板系は縦横 */}
        {isPlateKind ? (
          <>
            <div>
              <div className="text-xs text-gray-500 mb-1">横幅 W (mm)</div>
              <input
                className="rounded border px-3 py-1 text-sm w-[140px]"
                type="number"
                step="1"
                value={plateW}
                onChange={(e) => setPlateW(num(e.target.value, 1200))}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">高さ H (mm)</div>
              <input
                className="rounded border px-3 py-1 text-sm w-[140px]"
                type="number"
                step="1"
                value={plateH}
                onChange={(e) => setPlateH(num(e.target.value, 600))}
              />
            </div>
          </>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-1">長さ L (mm)</div>
            <input
              className="rounded border px-3 py-1 text-sm w-[160px]"
              type="number"
              step="1"
              value={length}
              onChange={(e) => setLength(num(e.target.value, 100))}
            />
          </div>
        )}

        <div className="text-xs text-gray-600 leading-relaxed">
          <div className="font-semibold">{kindLabel}</div>

          {kind === 'checker' && spec ? (
            <div>
              規格={spec.name} / 板厚 t={spec.t}
              {spec.unitMass != null ? ` / 単位質量=${spec.unitMass}` : ''}
              <div className="text-[11px] text-gray-500">※縞板は見た目用（重量はExcelの単重）</div>
            </div>
          ) : null}

          {kind === 'expand' && spec ? (
            <div>
              規格={spec.name}
              {spec.unitMass != null ? ` / 単位質量=${spec.unitMass}` : ''}
              <div className="text-[11px] text-gray-500">※エキスパンドは見た目用（重量はExcelの単重）</div>
            </div>
          ) : null}
        </div>

        {loadError ? <div className="text-[11px] text-red-600 whitespace-pre-wrap">Excel読み込み失敗: {loadError}</div> : null}

        {meta ? (
          <div className="text-[11px] text-gray-500 leading-relaxed">
            <div>読み込み元: {meta.sourceUrl}</div>
            <div>シート: {meta.sheetNames?.join(', ')}</div>
            {meta.warnings?.length ? (
              <div className="text-amber-700 whitespace-pre-wrap">注意: {meta.warnings.join('\n')}</div>
            ) : null}
          </div>
        ) : null}
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

          <OrbitControls enableDamping dampingFactor={0.08} zoomSpeed={0.35} rotateSpeed={0.6} panSpeed={0.6} />
        </Canvas>
      </div>

      <div className="text-[11px] text-gray-500">断面完成を優先 → 後で editor にそのまま移植する。</div>
    </div>
  );
}
