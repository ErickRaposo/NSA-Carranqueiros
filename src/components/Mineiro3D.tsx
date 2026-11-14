import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Mineiro3DProps {
  /** Current onboarding step index (0..3) drives gesture variations */
  stepIndex: number;
  /** Whether MINEIRØ is actively speaking / explaining */
  isExplaining: boolean;
  /** Layout size preset for onboarding vs floating HUD copilot */
  size?: 'full' | 'compact' | 'avatar';
}

export const Mineiro3D: React.FC<Mineiro3DProps> = ({
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

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, size === 'avatar' ? 0.14 : 0.1, size === 'avatar' ? 4.35 : 4.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Studio & space lighting (sober navy/white, no harsh neon)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(3.5, 4.2, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6488cc, 1.0);
    rimLight.position.set(-4, 2.5, -3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.45);
    fillLight.position.set(0, -3.5, 2.5);
    scene.add(fillLight);

    // Materials inspired by the Ø / ringed-planet symbol
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xeaf0f9,
      roughness: 0.34,
      metalness: 0.12,
    });
    const darkNavyMat = new THREE.MeshStandardMaterial({
      color: 0x061229,
      roughness: 0.16,
      metalness: 0.72,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.2,
    });
    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a6e,
      roughness: 0.45,
      metalness: 0.3,
    });
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    });
    const mouthBarMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
    });

    // Root Mascot Group (floats in zero-G)
    const mineiro = new THREE.Group();
    scene.add(mineiro);

    // Core Orb Body (breathes & tilts)
    const coreGroup = new THREE.Group();
    mineiro.add(coreGroup);

    const orbBody = new THREE.Mesh(new THREE.SphereGeometry(0.84, 48, 48), shellMat);
    coreGroup.add(orbBody);

    // Recessed Front Visor Band
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 36, 28),
      darkNavyMat
    );
    visor.scale.set(0.95, 0.62, 0.72);
    visor.position.set(0, 0.04, 0.36);
    coreGroup.add(visor);

    // Subtle Top Antenna / Sensor Crest
    const crestBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.08, 20),
      accentTrimMat
    );
    crestBase.position.set(0, 0.85, 0);
    coreGroup.add(crestBase);

    const crestStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.22, 12),
      ringMat
    );
    crestStem.position.set(0, 0.98, 0);
    coreGroup.add(crestStem);

    const crestTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), eyeMat);
    crestTip.position.set(0, 1.1, 0);
    coreGroup.add(crestTip);

    // Eyes Group inside Visor (blinks & glances)
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0.08, 0.87);
    coreGroup.add(eyesGroup);

    const eyeGeo = new THREE.CapsuleGeometry(0.058, 0.085, 8, 16);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.22, 0, 0);
    eyesGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.22, 0, 0);
    eyesGroup.add(rightEye);

    // Voice Waveform Mouth Bars (animates when MINEIRØ speaks)
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.14, 0.86);
    coreGroup.add(mouthGroup);

    const mouthBars: THREE.Mesh[] = [];
    const barOffsets = [-0.14, -0.07, 0, 0.07, 0.14];
    barOffsets.forEach((xOffset) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02), mouthBarMat);
      bar.position.set(xOffset, 0, 0);
      mouthGroup.add(bar);
      mouthBars.push(bar);
    });

    // Diagonal Orbital Ring (Signature Ø silhouette from the reference image)
    const ringPivot = new THREE.Group();
    ringPivot.rotation.z = 0.56; // ~32 deg diagonal tilt like the symbol
    ringPivot.rotation.x = 0.34;
    mineiro.add(ringPivot);

    const orbitalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.24, 0.075, 20, 84),
      ringMat
    );
    orbitalRing.rotation.x = Math.PI / 2;
    orbitalRing.scale.set(1.06, 1.0, 0.82);
    ringPivot.add(orbitalRing);

    // Small orbiting satellite node on the ring
    const ringNode = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), accentTrimMat);
    ringNode.position.set(1.31, 0, 0);
    ringPivot.add(ringNode);

    // Floating Articulated Mini-Hands (Zero-G stabilizers that wave & gesture)
    const createFloatingHand = (side: -1 | 1) => {
      const handPivot = new THREE.Group();
      handPivot.position.set(side * 1.16, -0.25, 0.28);

      const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.12, 8, 16), shellMat);
      handPivot.add(palm);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.03, 10, 20), accentTrimMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, -0.07, 0);
      handPivot.add(cuff);

      return handPivot;
    };

    const leftHand = createFloatingHand(-1);
    const rightHand = createFloatingHand(1);
    mineiro.add(leftHand);
    mineiro.add(rightHand);

    // Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;

    let nextBlinkTime = 1.9;
    let blinkProgress = 0;
    let isBlinking = false;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05) || 0.016;
      const step = stepRef.current;
      const explaining = explainingRef.current;

      // 1. Zero-G Floating (smooth figure-8 drift)
      mineiro.position.y = Math.sin(elapsed * 1.45) * 0.14;
      mineiro.position.x = Math.cos(elapsed * 0.85) * 0.05;
      mineiro.rotation.y = Math.sin(elapsed * 0.65) * 0.14;
      mineiro.rotation.z = Math.sin(elapsed * 0.9) * 0.035;

      // 2. Breathing (core orb gentle expansion)
      const breath = Math.sin(elapsed * 2.1);
      coreGroup.scale.set(1 + breath * 0.022, 1 + breath * 0.018, 1 + breath * 0.022);

      // 3. Diagonal Orbital Ring continuous rotation & gentle wobble
      ringPivot.rotation.y += dt * 0.48;
      ringPivot.rotation.x = 0.34 + Math.sin(elapsed * 1.1) * 0.06;

      // 4. Natural Eye Blinking
      if (!isBlinking && elapsed >= nextBlinkTime) {
        isBlinking = true;
        blinkProgress = 0;
      }
      if (isBlinking) {
        blinkProgress += dt * 7.8;
        const scaleY = blinkProgress < 0.5 ? 1 - blinkProgress * 1.9 : (blinkProgress - 0.5) * 1.9;
        const clamped = Math.max(0.06, Math.min(1, scaleY));
        leftEye.scale.y = clamped;
        rightEye.scale.y = clamped;
        if (blinkProgress >= 1) {
          isBlinking = false;
          leftEye.scale.y = 1;
          rightEye.scale.y = 1;
          nextBlinkTime = elapsed + 2.2 + Math.random() * 2.6;
        }
      }

      // Eye glance & head nod while talking
      eyesGroup.position.x = Math.sin(elapsed * 0.95) * 0.035;
      coreGroup.rotation.x = explaining
        ? Math.sin(elapsed * 3.5) * 0.05 + 0.03
        : Math.sin(elapsed * 1.1) * 0.025;

      // 5. Voice Waveform Mouth animation
      mouthBars.forEach((bar, i) => {
        if (explaining) {
          const wave = 1.0 + Math.abs(Math.sin(elapsed * 11.5 + i * 1.15)) * 2.9;
          bar.scale.y = wave;
        } else {
          bar.scale.y = 0.65 + Math.sin(elapsed * 2.2 + i * 0.6) * 0.2;
        }
      });

      // 6. Floating Hands Gestures per Step
      if (step === 0) {
        // Enthusiastic greeting wave with right hand
        rightHand.position.y = 0.25 + Math.sin(elapsed * 2.4) * 0.08;
        rightHand.position.x = 1.2 + Math.sin(elapsed * 4.5) * 0.1;
        rightHand.rotation.z = -0.45 + Math.sin(elapsed * 5.2) * 0.35;

        leftHand.position.y = -0.26 + Math.sin(elapsed * 1.6) * 0.08;
        leftHand.rotation.z = 0.2 + Math.sin(elapsed * 1.4) * 0.08;
      } else {
        // Expressive explaining gestures
        const talkWave = explaining ? Math.sin(elapsed * 4.4) * 0.18 : Math.sin(elapsed * 1.7) * 0.07;
        rightHand.position.y = -0.05 + talkWave;
        rightHand.position.x = 1.2 + Math.cos(elapsed * 2.8) * 0.06;
        rightHand.rotation.z = -0.35 + talkWave * 1.2;

        leftHand.position.y = -0.15 - talkWave * 0.7;
        leftHand.position.x = -1.18 - Math.sin(elapsed * 2.2) * 0.05;
        leftHand.rotation.z = 0.3 - talkWave * 0.9;
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={
        size === 'avatar'
          ? 'h-[62px] w-[62px]'
          : size === 'compact'
            ? 'h-[148px] w-[132px]'
            : 'h-[320px] w-full max-w-[360px] sm:h-[380px]'
      }
      aria-label="Mascote 3D flutuando e gesticulando enquanto explica o sistema"
    />
  );
};
