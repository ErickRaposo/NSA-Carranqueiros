import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HeroEarth3DProps {
  /** Normalized scroll progress 0..1 driving subtle orbital rotation */
  scrollProgressRef: React.MutableRefObject<number>;
}

/**
 * Generates a procedural equirectangular Earth texture with deep navy oceans,
 * stylized continental silhouettes, and glowing night-side city clusters.
 */
function createEarthTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Deep space ocean base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#091a36');
  oceanGrad.addColorStop(0.5, '#040d21');
  oceanGrad.addColorStop(1, '#07152e');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Simplified continental landmass polygons (equirectangular normalized 0..1)
  const continents: Array<Array<[number, number]>> = [
    // Americas
    [
      [0.14, 0.18], [0.22, 0.14], [0.31, 0.2], [0.29, 0.34], [0.25, 0.42],
      [0.27, 0.48], [0.34, 0.54], [0.36, 0.65], [0.31, 0.82], [0.27, 0.84],
      [0.25, 0.66], [0.21, 0.52], [0.16, 0.38], [0.12, 0.27],
    ],
    // Europe + Africa
    [
      [0.45, 0.18], [0.55, 0.15], [0.58, 0.25], [0.54, 0.34], [0.59, 0.42],
      [0.61, 0.54], [0.56, 0.72], [0.51, 0.76], [0.47, 0.62], [0.44, 0.48],
      [0.43, 0.34], [0.46, 0.25],
    ],
    // Asia
    [
      [0.57, 0.14], [0.76, 0.15], [0.87, 0.24], [0.84, 0.39], [0.77, 0.48],
      [0.69, 0.5], [0.62, 0.43], [0.56, 0.33],
    ],
    // Australia
    [
      [0.78, 0.63], [0.87, 0.62], [0.89, 0.73], [0.81, 0.76], [0.76, 0.7],
    ],
  ];

  // Landmass fill + subtle atmospheric coastal rim
  continents.forEach((poly) => {
    ctx.save();
    ctx.beginPath();
    poly.forEach(([nx, ny], idx) => {
      const px = nx * width;
      const py = ny * height;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    const landGrad = ctx.createRadialGradient(
      width * 0.52,
      height * 0.45,
      40,
      width * 0.52,
      height * 0.45,
      width * 0.55
    );
    landGrad.addColorStop(0, '#13315c');
    landGrad.addColorStop(0.6, '#0d2244');
    landGrad.addColorStop(1, '#081833');
    ctx.fillStyle = landGrad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.stroke();
    ctx.restore();
  });

  // Subtle latitude/longitude telemetry grid
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const x = (width / 12) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let j = 1; j < 6; j++) {
    const y = (height / 6) * j;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Luminous night-side city lights & aurora wisps
  const hubs: Array<[number, number, number]> = [
    [0.24, 0.29, 26], [0.29, 0.34, 22], [0.31, 0.58, 22], [0.33, 0.66, 26],
    [0.49, 0.26, 30], [0.53, 0.3, 24], [0.53, 0.52, 18], [0.66, 0.39, 28],
    [0.75, 0.35, 32], [0.81, 0.31, 24], [0.84, 0.69, 16],
  ];

  // Deterministic pseudo-random for crisp city clusters
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  hubs.forEach(([hx, hy, count]) => {
    for (let i = 0; i < count; i++) {
      const dx = (rand() - 0.5) * 0.055;
      const dy = (rand() - 0.5) * 0.045;
      const x = (hx + dx) * width;
      const y = (hy + dy) * height;
      const r = 0.8 + rand() * 1.9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rand() > 0.35 ? 'rgba(253, 224, 71, 0.72)' : 'rgba(125, 211, 252, 0.7)';
      ctx.fill();
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export const HeroEarth3D: React.FC<HeroEarth3DProps> = ({ scrollProgressRef }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 640;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.12, 4.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Lighting matching Image 1's dramatic orbital rim + cool space fill
    const ambient = new THREE.AmbientLight(0x3b82f6, 0.42);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    sunLight.position.set(4.5, 2.8, 3.2);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-4.2, -1.2, -2.6);
    scene.add(rimLight);

    const earthTex = createEarthTexture();
    const earthGeo = new THREE.SphereGeometry(1.36, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.62,
      metalness: 0.12,
      emissive: new THREE.Color(0x0a1c3a),
      emissiveIntensity: 0.55,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = 0.22;
    scene.add(earthMesh);

    // Atmospheric Fresnel horizon glow
    const atmoGeo = new THREE.SphereGeometry(1.44, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x38bdf8) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewPos = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          float rim = 1.0 - max(0.0, dot(normalize(vViewPos), -vNormal));
          float glow = pow(rim, 3.2) * 0.85;
          gl_FragColor = vec4(uColor, glow);
        }
      `,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const scrollRot = scrollProgressRef.current * 1.45;
      const baseSpin = prefersReducedMotion ? 0 : elapsed * 0.055;
      earthMesh.rotation.y = -0.9 + baseSpin + scrollRot;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 640;
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
      earthGeo.dispose();
      earthMat.dispose();
      earthTex.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scrollProgressRef]);

  return (
    <div
      ref={containerRef}
      className="entry-earth-canvas"
      aria-hidden="true"
    />
  );
};
