/**
 * Boot: adapt + WebGPU stage + 2048 (DOM on #ui-root).
 */

import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  applyStageTransform,
  computeStageLayout,
  watchStageLayout,
  type StageLayout,
} from './adapt/design';
import { mountDevicePreview } from './adapt/devicePreview';
import { applyNativeClass, applySafeAreaCssVars } from './adapt/safeArea';
import { audio } from './audio/AudioManager';
import { createRenderer, resizeToDesign } from './create-renderer';
import { startGame2048 } from './game/game2048';

async function boot(): Promise<void> {
  applyNativeClass();

  const shell = document.getElementById('shell')!;
  const viewportEl = document.getElementById('viewport')!;
  const stage = document.getElementById('stage')!;
  const uiRoot = document.getElementById('ui-root')!;

  const renderer = await createRenderer({ container: stage });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfaf8ef);
  const camera = new THREE.OrthographicCamera(
    0,
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
    0,
    -1,
    1,
  );

  const onLayout = (layout: StageLayout) => {
    applyStageTransform(stage, layout);
    applySafeAreaCssVars(Capacitor.isNativePlatform());
    renderer.setSize(DESIGN_WIDTH, DESIGN_HEIGHT, false);
    resizeToDesign(renderer);
  };

  const preview = mountDevicePreview(shell, viewportEl, () => {
    const size = preview.getViewSize();
    onLayout(computeStageLayout(size.width, size.height, 'contain'));
  });

  const unwatch = watchStageLayout(onLayout, {
    mode: 'contain',
    getViewSize: () => preview.getViewSize(),
  });

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  void audio.preload();

  const game = startGame2048({
    stage,
    uiRoot,
  });

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  window.addEventListener(
    'pagehide',
    () => {
      game.dispose();
      audio.dispose();
      unwatch();
      preview.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );
}

boot().catch((err) => {
  console.error(err);
});
