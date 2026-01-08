'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 要望仕様:
 * - ホイール: ズーム（感度 adjustable）
 * - 中クリック押し込みドラッグ: 回転
 * - 左右同時押しドラッグ: 平行移動
 * - 左だけ/右だけドラッグは何もしない（今後の選択操作のため）
 *
 * 重要:
 * - window に pointermove/up を貼ると UI(input等) が死るので禁止
 * - PointerCapture を使って、ドラッグ中だけ canvas にイベントを戻す
 *
 * 追加:
 * - ref で setView(viewName) を呼べる（視点切り替え）
 */
const CustomCameraControls = forwardRef(function CustomCameraControls(
  {
    enabled = true,
    zoomSensitivity = 1.0,
    rotateSensitivity = 1.0,
    panSensitivity = 1.0,
  },
  ref
) {
  const { camera, gl } = useThree();

  const stateRef = useRef({
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    mode: 'none', // 'rotate' | 'pan' | 'none'
  });

  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);
  const vTemp = useMemo(() => new THREE.Vector3(), []);
  const vRight = useMemo(() => new THREE.Vector3(), []);
  const vUp = useMemo(() => new THREE.Vector3(), []);

  function syncFromCamera() {
    vTemp.copy(camera.position).sub(target);
    spherical.setFromVector3(vTemp);
    spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, spherical.phi));
  }

  function applyToCamera() {
    vTemp.setFromSpherical(spherical).add(target);
    camera.position.copy(vTemp);
    camera.lookAt(target);
  }

  function setModeFromButtons(buttonsBitmask) {
    // left=1, right=2, middle=4
    if (buttonsBitmask === 4) return 'rotate';
    if (buttonsBitmask === 3) return 'pan';
    return 'none';
  }

  function rotateBy(dx, dy) {
    const element = gl.domElement;
    const rotSpeed = 0.0035 * rotateSensitivity;

    spherical.theta -= (dx / element.clientWidth) * Math.PI * 2 * rotSpeed * 100;
    spherical.phi -= (dy / element.clientHeight) * Math.PI * rotSpeed * 100;

    spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, spherical.phi));
  }

  function panBy(dx, dy) {
    const element = gl.domElement;
    const distance = spherical.radius;
    const fov = (camera.fov * Math.PI) / 180;
    const screenHeightAtDist = 2 * Math.tan(fov / 2) * distance;

    const panX = (-dx / element.clientHeight) * screenHeightAtDist * panSensitivity;
    const panY = (dy / element.clientHeight) * screenHeightAtDist * panSensitivity;

    vTemp.copy(camera.position).sub(target).normalize();
    vUp.copy(camera.up).normalize();
    vRight.crossVectors(vUp, vTemp).normalize();

    const move = new THREE.Vector3()
      .addScaledVector(vRight, panX)
      .addScaledVector(vUp, panY);

    target.add(move);
  }

  function zoomByWheel(deltaY) {
    const base = 0.0012;
    const k = base * zoomSensitivity;

    const zoomFactor = Math.exp(deltaY * k);
    spherical.radius *= zoomFactor;

    // ✅ mmスケール前提：寄り過ぎ/遠すぎ防止（必要なら後で調整）
    spherical.radius = Math.max(100, Math.min(300000, spherical.radius));
  }

  // ===== 視点切り替え API =====
  function setView(viewName) {
    syncFromCamera();

    const clampPhi = (phi) => Math.max(0.001, Math.min(Math.PI - 0.001, phi));

    // three.js Spherical:
    // theta: Y軸周り（0 は +Z 方向）
    // phi  : 上からの角度（0 は真上）
    if (viewName === 'front') {
      spherical.theta = 0;
      spherical.phi = Math.PI / 2;
    } else if (viewName === 'back') {
      spherical.theta = Math.PI;
      spherical.phi = Math.PI / 2;
    } else if (viewName === 'right') {
      spherical.theta = Math.PI / 2;
      spherical.phi = Math.PI / 2;
    } else if (viewName === 'left') {
      spherical.theta = -Math.PI / 2;
      spherical.phi = Math.PI / 2;
    } else if (viewName === 'top') {
      spherical.phi = 0.001;
    } else if (viewName === 'bottom') {
      spherical.phi = Math.PI - 0.001;
    } else if (viewName === 'iso') {
      spherical.theta = Math.PI / 4;
      spherical.phi = Math.PI / 3;
    }

    spherical.phi = clampPhi(spherical.phi);
    applyToCamera();
  }

  useImperativeHandle(ref, () => ({
    setView,
    // おまけ：必要なら後で使える
    setTarget: (x, y, z) => {
      target.set(x, y, z);
      syncFromCamera();
      applyToCamera();
    },
    getTarget: () => target.clone(),
  }));

  useEffect(() => {
    const el = gl.domElement;

    syncFromCamera();
    applyToCamera();

    const onPointerDown = (e) => {
      if (!enabled) return;

      // 中ボタン押し込みのときブラウザのオートスクロールを出さない
      if (e.button === 1) e.preventDefault();

      stateRef.current.isDragging = true;
      stateRef.current.pointerId = e.pointerId;
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;
      stateRef.current.mode = setModeFromButtons(e.buttons);

      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {}

      syncFromCamera();
    };

    const onPointerMove = (e) => {
      if (!enabled) return;
      if (!stateRef.current.isDragging) return;
      if (stateRef.current.pointerId != null && e.pointerId !== stateRef.current.pointerId) return;

      const dx = e.clientX - stateRef.current.lastX;
      const dy = e.clientY - stateRef.current.lastY;
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;

      const mode = setModeFromButtons(e.buttons);
      stateRef.current.mode = mode;

      if (mode === 'rotate') {
        rotateBy(dx, dy);
        applyToCamera();
      } else if (mode === 'pan') {
        panBy(dx, dy);
        applyToCamera();
      }
    };

    const endDrag = (e) => {
      if (!enabled) return;
      if (!stateRef.current.isDragging) return;
      if (stateRef.current.pointerId != null && e.pointerId !== stateRef.current.pointerId) return;

      stateRef.current.isDragging = false;
      stateRef.current.mode = 'none';
      const pid = stateRef.current.pointerId;
      stateRef.current.pointerId = null;

      try {
        if (pid != null) el.releasePointerCapture?.(pid);
      } catch {}
    };

    const onWheel = (e) => {
      if (!enabled) return;

      e.preventDefault();
      syncFromCamera();
      zoomByWheel(e.deltaY);
      applyToCamera();
    };

    const onContextMenu = (e) => {
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', endDrag, { passive: false });
    el.addEventListener('pointercancel', endDrag, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, camera, target, spherical, zoomSensitivity, rotateSensitivity, panSensitivity, enabled]);

  return null;
});

export default CustomCameraControls;
