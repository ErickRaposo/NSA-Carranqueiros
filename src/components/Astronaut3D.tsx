import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Astronaut3DProps {
  /** Current onboarding step index (0..3) drives gesture variations */
  stepIndex: number;
  /** Whether the astronaut is actively explaining / narrating */
  isExplaining: boolean;
}

export const Astronaut3D: React.FC<Astronaut3DProps> = ({ stepIndex, isExplaining }) => {
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
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Sober studio/space lighting (no neon)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.75);
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
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef7,
      roughness: 0.42,
      metalness: 0.08,
    });
    const darkNavyMat = new THREE.MeshStandardMaterial({
      color: 0x0b1936,
      roughness: 0.45,
      metalness: 0.25,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x1e3563,
      roughness: 0.55,
      metalness: 0.2,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x071329,
      roughness: 0.12,
      metalness: 0.82,
    });
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    });
    const chestIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
    });

    // Root Astronaut Group (floats in zero-G)
    const astronaut = new THREE.Group();
    scene.add(astronaut);

    // Torso Group (breathes)
    const torsoGroup = new THREE.Group();
    astronaut.add(torsoGroup);

    const torsoGeo = new THREE.CapsuleGeometry(0.46, 0.52, 12, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
    torsoGroup.add(torsoMesh);

    // Chest Control Pack
    const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.14), darkNavyMat);
    chestPack.position.set(0, 0.08, 0.43);
    torsoGroup.add(chestPack);

    const chestIndicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.02),
      chestIndicatorMat
    );
    chestIndicator.position.set(0, 0.14, 0.5);
    torsoGroup.add(chestIndicator);

    // Belt
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 24), darkNavyMat);
    belt.position.set(0, -0.34, 0);
    torsoGroup.add(belt);

    // Life-support Backpack
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.34), darkNavyMat);
    backpack.position.set(0, 0.08, -0.45);
    torsoGroup.add(backpack);

    const backpackTrim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.37), jointMat);
    backpackTrim.position.set(0, 0.08, -0.46);
    torsoGroup.add(backpackTrim);

    // Head / Helmet Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.86, 0);
    astronaut.add(headGroup);

    const neckCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.07, 12, 28),
      darkNavyMat
    );
    neckCollar.rotation.x = Math.PI / 2;
    neckCollar.position.set(0, -0.26, 0);
    headGroup.add(neckCollar);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 32), suitMat);
    headGroup.add(helmet);

    // Visor
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.41, 32, 24), visorMat);
    visor.scale.set(1.02, 0.88, 0.88);
    visor.position.set(0, 0.01, 0.12);
    headGroup.add(visor);

    // Eyes Group inside Visor (blinks & looks subtly)
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0.03, 0.49);
    headGroup.add(eyesGroup);

    const eyeGeo = new THREE.CapsuleGeometry(0.035, 0.045, 8, 12);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0, 0);
    eyesGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0, 0);
    eyesGroup.add(rightEye);

    // Articulated Left Arm
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.56, 0.28, 0);
    astronaut.add(leftShoulder);

    const shoulderJointL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), jointMat);
    leftShoulder.add(shoulderJointL);

    const upperArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.34, 8, 16), suitMat);
    upperArmL.position.set(-0.04, -0.25, 0);
    leftShoulder.add(upperArmL);

    const leftElbow = new THREE.Group();
    leftElbow.position.set(-0.04, -0.48, 0);
    leftShoulder.add(leftElbow);

    const forearmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 8, 16), suitMat);
    forearmL.position.set(0, -0.2, 0.04);
    leftElbow.add(forearmL);

    const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), darkNavyMat);
    gloveL.position.set(0, -0.4, 0.06);
    leftElbow.add(gloveL);

    // Articulated Right Arm (main gesturing arm)
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.56, 0.28, 0);
    astronaut.add(rightShoulder);

    const shoulderJointR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), jointMat);
    rightShoulder.add(shoulderJointR);

    const upperArmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.34, 8, 16), suitMat);
    upperArmR.position.set(0.04, -0.25, 0);
    rightShoulder.add(upperArmR);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(0.04, -0.48, 0);
    rightShoulder.add(rightElbow);

    const forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 8, 16), suitMat);
    forearmR.position.set(0, -0.2, 0.04);
    rightElbow.add(forearmR);

    const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), darkNavyMat);
    gloveR.position.set(0, -0.4, 0.06);
    rightElbow.add(gloveR);

    // Legs
    const createLeg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, -0.52, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 8, 16), suitMat);
      thigh.position.set(0, -0.24, 0);
      legGroup.add(thigh);

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), jointMat);
      knee.position.set(0, -0.48, 0.02);
      legGroup.add(knee);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.34, 8, 16), suitMat);
      shin.position.set(0, -0.72, 0);
      legGroup.add(shin);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.34), darkNavyMat);
      boot.position.set(0, -0.96, 0.06);
      legGroup.add(boot);

      return legGroup;
    };

    const leftLeg = createLeg(-0.22);
    const rightLeg = createLeg(0.22);
    astronaut.add(leftLeg);
    astronaut.add(rightLeg);

    // Animation loop
    const clock = new THREE.Clock();
    let frameId = 0;

    // Blink state
    let nextBlinkTime = 2.2;
    let blinkProgress = 0;
    let isBlinking = false;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05) || 0.016;
      const step = stepRef.current;
      const explaining = explainingRef.current;

      // 1. Zero-G Floating
      astronaut.position.y = Math.sin(elapsed * 1.4) * 0.1 - 0.1;
      astronaut.rotation.y = Math.sin(elapsed * 0.65) * 0.12;
      astronaut.rotation.z = Math.sin(elapsed * 0.85) * 0.03;

      // 2. Breathing (torso expansion + subtle shoulder rise)
      const breath = Math.sin(elapsed * 2.1);
      torsoGroup.scale.set(1 + breath * 0.022, 1 + breath * 0.015, 1 + breath * 0.03);
      leftShoulder.position.y = 0.28 + breath * 0.016;
      rightShoulder.position.y = 0.28 + breath * 0.016;

      // Gentle chest light pulse
      chestIndicatorMat.color.setHSL(0.59, 0.7, 0.6 + breath * 0.12);

      // 3. Natural Eye Blinking
      if (!isBlinking && elapsed >= nextBlinkTime) {
        isBlinking = true;
        blinkProgress = 0;
      }
      if (isBlinking) {
        blinkProgress += dt * 7.5;
        const scaleY = blinkProgress < 0.5 ? 1 - blinkProgress * 1.9 : (blinkProgress - 0.5) * 1.9;
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

      // Subtle eye glance
      eyesGroup.position.x = Math.sin(elapsed * 0.9) * 0.025;

      // 4. Head Tilt & Nod when explaining
      headGroup.rotation.x = explaining
        ? Math.sin(elapsed * 3.4) * 0.055 + 0.04
        : Math.sin(elapsed * 1.1) * 0.03;
      headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.09;
      headGroup.rotation.z = Math.cos(elapsed * 0.7) * 0.04;

      // 5. Arm Gestures per Step
      if (step === 0) {
        // Friendly wave with right arm
        rightShoulder.rotation.z = 1.95 + Math.sin(elapsed * 4.2) * 0.25;
        rightShoulder.rotation.x = -0.35;
        rightElbow.rotation.z = 0.45 + Math.sin(elapsed * 4.2) * 0.2;
        leftShoulder.rotation.z = -0.18 + breath * 0.04;
        leftShoulder.rotation.x = Math.sin(elapsed * 1.2) * 0.08;
        leftElbow.rotation.x = -0.3;
      } else {
        // Presenting / Explaining gestures
        const talkGesture = explaining ? Math.sin(elapsed * 4.8) * 0.18 : Math.sin(elapsed * 1.8) * 0.08;
        rightShoulder.rotation.z = 0.65 + talkGesture;
        rightShoulder.rotation.x = -0.65 + Math.cos(elapsed * 2.6) * 0.12;
        rightElbow.rotation.x = -0.85 + talkGesture * 0.8;
        rightElbow.rotation.z = 0.15;

        leftShoulder.rotation.z = -0.35 - talkGesture * 0.5;
        leftShoulder.rotation.x = -0.35 + Math.sin(elapsed * 2.1) * 0.1;
        leftElbow.rotation.x = -0.65;
      }

      // Gentle zero-G leg float
      leftLeg.rotation.x = Math.sin(elapsed * 1.3) * 0.08 + 0.08;
      rightLeg.rotation.x = Math.sin(elapsed * 1.3 + Math.PI) * 0.08 + 0.05;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
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
      className="h-[340px] w-full max-w-[380px] sm:h-[400px]"
      aria-label="Astronauta 3D animado explicando como o sistema funciona"
    />
  );
};
