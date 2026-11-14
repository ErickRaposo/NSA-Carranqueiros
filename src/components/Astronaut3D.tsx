import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Astronaut3DProps {
  /** Current onboarding / copilot state (0..3) drives gesture variations */
  stepIndex: number;
  /** Whether the astronaut is actively explaining / narrating */
  isExplaining: boolean;
  /** Render full onboarding stage or compact map copilot widget */
  size?: 'full' | 'compact';
}

export const Astronaut3D: React.FC<Astronaut3DProps> = ({
  stepIndex,
  isExplaining,
  size = 'full',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef(stepIndex);
  const explainingRef = useRef(isExplaining);

  useEffect(() => {
    stepRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    explainingRef.current = isExplaining;
  }, [isExplaining]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const fallbackW = size === 'compact' ? 136 : 360;
    const fallbackH = size === 'compact' ? 156 : 400;
    const width = container.clientWidth || fallbackW;
    const height = container.clientHeight || fallbackH;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
      geometries.push(geo);
      return geo;
    };
    const trackMat = <T extends THREE.Material>(mat: T): T => {
      materials.push(mat);
      return mat;
    };

    // Sober studio/space lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.78);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(3.5, 4.5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6488cc, 0.9);
    rimLight.position.set(-4, 2.5, -3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.45);
    fillLight.position.set(0, -3, 2.5);
    scene.add(fillLight);

    // Materials
    const suitMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe8eef7,
        roughness: 0.42,
        metalness: 0.08,
      })
    );
    const darkNavyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b1936,
        roughness: 0.45,
        metalness: 0.25,
      })
    );
    const jointMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e3563,
        roughness: 0.55,
        metalness: 0.2,
      })
    );
    const visorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x071329,
        roughness: 0.12,
        metalness: 0.82,
      })
    );
    const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
    const chestIndicatorMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));

    const astronaut = new THREE.Group();
    scene.add(astronaut);

    // Torso
    const torsoGroup = new THREE.Group();
    astronaut.add(torsoGroup);

    const torsoMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.46, 0.52, 12, 24)),
      suitMat
    );
    torsoGroup.add(torsoMesh);

    const chestPack = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.46, 0.32, 0.14)),
      darkNavyMat
    );
    chestPack.position.set(0, 0.08, 0.43);
    torsoGroup.add(chestPack);

    const chestIndicator = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.24, 0.05, 0.02)),
      chestIndicatorMat
    );
    chestIndicator.position.set(0, 0.14, 0.5);
    torsoGroup.add(chestIndicator);

    const belt = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 24)),
      darkNavyMat
    );
    belt.position.set(0, -0.34, 0);
    torsoGroup.add(belt);

    const backpack = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.68, 0.78, 0.34)),
      darkNavyMat
    );
    backpack.position.set(0, 0.08, -0.45);
    torsoGroup.add(backpack);

    const backpackTrim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.54, 0.56, 0.37)),
      jointMat
    );
    backpackTrim.position.set(0, 0.08, -0.46);
    torsoGroup.add(backpackTrim);

    // Head / Helmet
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.86, 0);
    astronaut.add(headGroup);

    const neckCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.32, 0.07, 12, 28)),
      darkNavyMat
    );
    neckCollar.rotation.x = Math.PI / 2;
    neckCollar.position.set(0, -0.26, 0);
    headGroup.add(neckCollar);

    const helmet = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.46, 32, 32)), suitMat);
    headGroup.add(helmet);

    const visor = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.41, 32, 24)), visorMat);
    visor.scale.set(1.02, 0.88, 0.88);
    visor.position.set(0, 0.01, 0.12);
    headGroup.add(visor);

    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0.03, 0.49);
    headGroup.add(eyesGroup);

    const eyeGeo = trackGeo(new THREE.CapsuleGeometry(0.035, 0.045, 8, 12));
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0, 0);
    eyesGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0, 0);
    eyesGroup.add(rightEye);

    // Left Arm
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.56, 0.28, 0);
    astronaut.add(leftShoulder);

    const shoulderGeo = trackGeo(new THREE.SphereGeometry(0.14, 16, 16));
    const upperArmGeo = trackGeo(new THREE.CapsuleGeometry(0.12, 0.34, 8, 16));
    const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.11, 0.28, 8, 16));
    const gloveGeo = trackGeo(new THREE.SphereGeometry(0.13, 16, 16));

    leftShoulder.add(new THREE.Mesh(shoulderGeo, jointMat));
    const upperArmL = new THREE.Mesh(upperArmGeo, suitMat);
    upperArmL.position.set(-0.04, -0.25, 0);
    leftShoulder.add(upperArmL);

    const leftElbow = new THREE.Group();
    leftElbow.position.set(-0.04, -0.48, 0);
    leftShoulder.add(leftElbow);

    const forearmL = new THREE.Mesh(forearmGeo, suitMat);
    forearmL.position.set(0, -0.2, 0.04);
    leftElbow.add(forearmL);

    const gloveL = new THREE.Mesh(gloveGeo, darkNavyMat);
    gloveL.position.set(0, -0.4, 0.06);
    leftElbow.add(gloveL);

    // Right Arm
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.56, 0.28, 0);
    astronaut.add(rightShoulder);

    rightShoulder.add(new THREE.Mesh(shoulderGeo, jointMat));
    const upperArmR = new THREE.Mesh(upperArmGeo, suitMat);
    upperArmR.position.set(0.04, -0.25, 0);
    rightShoulder.add(upperArmR);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(0.04, -0.48, 0);
    rightShoulder.add(rightElbow);

    const forearmR = new THREE.Mesh(forearmGeo, suitMat);
    forearmR.position.set(0, -0.2, 0.04);
    rightElbow.add(forearmR);

    const gloveR = new THREE.Mesh(gloveGeo, darkNavyMat);
    gloveR.position.set(0, -0.4, 0.06);
    rightElbow.add(gloveR);

    // Legs
    const thighGeo = trackGeo(new THREE.CapsuleGeometry(0.15, 0.36, 8, 16));
    const kneeGeo = trackGeo(new THREE.SphereGeometry(0.14, 12, 12));
    const shinGeo = trackGeo(new THREE.CapsuleGeometry(0.13, 0.34, 8, 16));
    const bootGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.16, 0.34));

    const createLeg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, -0.52, 0);

      const thigh = new THREE.Mesh(thighGeo, suitMat);
      thigh.position.set(0, -0.24, 0);
      legGroup.add(thigh);

      const knee = new THREE.Mesh(kneeGeo, jointMat);
      knee.position.set(0, -0.48, 0.02);
      legGroup.add(knee);

      const shin = new THREE.Mesh(shinGeo, suitMat);
      shin.position.set(0, -0.72, 0);
      legGroup.add(shin);

      const boot = new THREE.Mesh(bootGeo, darkNavyMat);
      boot.position.set(0, -0.96, 0.06);
      legGroup.add(boot);

      return legGroup;
    };

    const leftLeg = createLeg(-0.22);
    const rightLeg = createLeg(0.22);
    astronaut.add(leftLeg);
    astronaut.add(rightLeg);

    const clock = new THREE.Clock();
    let frameId = 0;
    let nextBlinkTime = 2.2;
    let blinkProgress = 0;
    let isBlinking = false;

    const applyPose = (elapsed: number, dt: number) => {
      const step = stepRef.current;
      const explaining = explainingRef.current;
      const motion = prefersReducedMotion ? 0 : 1;

      astronaut.position.y = Math.sin(elapsed * 1.4) * 0.1 * motion - 0.1;
      astronaut.rotation.y = Math.sin(elapsed * 0.65) * 0.12 * motion;
      astronaut.rotation.z = Math.sin(elapsed * 0.85) * 0.03 * motion;

      const breath = Math.sin(elapsed * 2.1) * motion;
      torsoGroup.scale.set(1 + breath * 0.022, 1 + breath * 0.015, 1 + breath * 0.03);
      leftShoulder.position.y = 0.28 + breath * 0.016;
      rightShoulder.position.y = 0.28 + breath * 0.016;

      chestIndicatorMat.color.setHSL(0.55, 0.85, explaining ? 0.64 + breath * 0.12 : 0.56);

      if (!prefersReducedMotion) {
        if (!isBlinking && elapsed >= nextBlinkTime) {
          isBlinking = true;
          blinkProgress = 0;
        }
        if (isBlinking) {
          blinkProgress += dt * 7.5;
          const scaleY =
            blinkProgress < 0.5 ? 1 - blinkProgress * 1.9 : (blinkProgress - 0.5) * 1.9;
          const clamped = Math.max(0.06, Math.min(1, scaleY));
          leftEye.scale.y = clamped;
          rightEye.scale.y = clamped;
          if (blinkProgress >= 1) {
            isBlinking = false;
            leftEye.scale.y = 1;
            rightEye.scale.y = 1;
            nextBlinkTime = elapsed + 2.4 + Math.random() * 2.6;
          }
        }
        eyesGroup.position.x = Math.sin(elapsed * 0.9) * 0.025;
      }

      headGroup.rotation.x = explaining
        ? Math.sin(elapsed * 3.4) * 0.055 * motion + 0.04
        : Math.sin(elapsed * 1.1) * 0.03 * motion;
      headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.09 * motion;
      headGroup.rotation.z = Math.cos(elapsed * 0.7) * 0.04 * motion;

      if (step === 0) {
        rightShoulder.rotation.z = 1.95 + Math.sin(elapsed * 4.2) * 0.25 * motion;
        rightShoulder.rotation.x = -0.35;
        rightElbow.rotation.z = 0.45 + Math.sin(elapsed * 4.2) * 0.2 * motion;
        leftShoulder.rotation.z = -0.18 + breath * 0.04;
        leftShoulder.rotation.x = Math.sin(elapsed * 1.2) * 0.08 * motion;
        leftElbow.rotation.x = -0.3;
      } else {
        const talkGesture =
          (explaining ? Math.sin(elapsed * 4.8) * 0.18 : Math.sin(elapsed * 1.8) * 0.08) *
          motion;
        rightShoulder.rotation.z = 0.65 + talkGesture;
        rightShoulder.rotation.x = -0.65 + Math.cos(elapsed * 2.6) * 0.12 * motion;
        rightElbow.rotation.x = -0.85 + talkGesture * 0.8;
        rightElbow.rotation.z = 0.15;

        leftShoulder.rotation.z = -0.35 - talkGesture * 0.5;
        leftShoulder.rotation.x = -0.35 + Math.sin(elapsed * 2.1) * 0.1 * motion;
        leftElbow.rotation.x = -0.65;
      }

      leftLeg.rotation.x = Math.sin(elapsed * 1.3) * 0.08 * motion + 0.08;
      rightLeg.rotation.x = Math.sin(elapsed * 1.3 + Math.PI) * 0.08 * motion + 0.05;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05) || 0.016;
      applyPose(elapsed, dt);
      renderer.render(scene, camera);
      if (!prefersReducedMotion) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    animate();

    const updateSize = (w: number, h: number) => {
      const safeW = Math.max(80, w);
      const safeH = Math.max(80, h);
      camera.aspect = safeW / safeH;
      camera.updateProjectionMatrix();
      renderer.setSize(safeW, safeH);
      if (prefersReducedMotion) {
        renderer.render(scene, camera);
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
              updateSize(entry.contentRect.width, entry.contentRect.height);
            }
          })
        : null;
    resizeObserver?.observe(container);

    const handleWindowResize = () => {
      updateSize(container.clientWidth || fallbackW, container.clientHeight || fallbackH);
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (frameId) window.cancelAnimationFrame(frameId);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={
        size === 'compact'
          ? 'h-[150px] w-[132px] shrink-0'
          : 'h-[320px] w-full max-w-[380px] sm:h-[380px]'
      }
      role="img"
      aria-label="Astronauta 3D animado acompanhando a explicação do sistema EARTHSONG"
    />
  );
};
