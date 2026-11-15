import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  FLAT_HEIGHT,
  FLAT_WIDTH,
  GLOBE_RADIUS,
  buildMorphEarthGeometry,
  buildMorphGraticuleGeometry,
  buildMorphLinesFromRings,
  flatPointToLonLat,
  lonLatToFlat,
  lonLatToSphere,
  spherePointToLonLat,
} from '../geo/projection';
import { CountryEntry, findCountryAtLonLat } from '../geo/countries';
import { createCountryMaskTexture } from '../geo/countryMask';
import { BlendMode, DatasetId, LayerConfig } from '../datasets/nasaDatasets';
import { Lang } from '../experience/types';

export interface CameraViewTarget {
  lon: number;
  lat: number;
  distance: number;
  nonce: number;
}

export interface HoverInfo {
  lon: number;
  lat: number;
  country: CountryEntry | null;
}

export type VisualArtStyle = 'bioluminescent' | 'infrared' | 'blueprint' | 'satellite';

interface EarthCanvasProps {
  videoElements: Partial<Record<DatasetId, HTMLVideoElement | null>>;
  layers: LayerConfig[];
  viewMode: '3d' | '2d';
  visualStyle?: VisualArtStyle;
  orbitAutoRotate?: boolean;
  /** Angular rotation speed in degrees/sec when orbitAutoRotate is active (default 1.92) */
  autoRotateSpeedDegPerSec?: number;
  /** Extra blue atmospheric highlight intensity (0..1) around the 3D globe */
  blueHighlightBoost?: number;
  showBorders: boolean;
  showGrid: boolean;
  showLabels: boolean;
  highContrast: boolean;
  hdEnhance?: boolean;
  lang?: Lang;
  backgroundHex?: string;
  frameOffsetRatio?: number;
  availableCountryIds?: ReadonlySet<string>;
  countries: CountryEntry[];
  allRings: number[][][];
  landBorderRings?: number[][][];
  coastlineRings?: number[][][];
  selectedCountry: CountryEntry | null;
  jukeboxPlaying?: boolean;
  motionPaused?: boolean;
  interactive?: boolean;
  flyTarget: CameraViewTarget | null;
  zoomCommand?: { delta: number; nonce: number } | null;
  panCommand?: { dLon: number; dLat: number; nonce: number } | null;
  onHoverChange: (info: HoverInfo | null) => void;
  onCameraDistanceChange: (distance: number) => void;
  onCameraCenterChange?: (lon: number, lat: number) => void;
  onSelectCountry: (country: CountryEntry | null) => void;
  onRegisterPosterCapture?: (
    fn: (() => { glCanvas: HTMLCanvasElement; fxCanvas: HTMLCanvasElement | null } | null) | null
  ) => void;
}

const VISUAL_STYLE_INDEX: Record<VisualArtStyle, number> = {
  bioluminescent: 0,
  infrared: 1,
  blueprint: 2,
  satellite: 3,
};

const BLEND_MODE_INDEX: Record<BlendMode, number> = {
  normal: 0,
  screen: 1,
  add: 2,
  multiply: 3,
  overlay: 4,
  difference: 5,
};

const EARTH_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aFlatPosition;
  uniform float uFlatMix;
  varying vec2 vUv;
  varying vec3 vNormalDir;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 morphed = mix(position, aFlatPosition, uFlatMix);
    vec3 sphereNormal = normalize(position);
    vec3 flatNormal = vec3(0.0, 0.0, 1.0);
    vNormalDir = normalize(mix(sphereNormal, flatNormal, uFlatMix));
    vec4 worldPos = modelMatrix * vec4(morphed, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTex0;
  uniform sampler2D uTex1;
  uniform sampler2D uTex2;
  uniform sampler2D uTex3;
  uniform sampler2D uTex4;

  uniform vec2 uTexSize0;
  uniform vec2 uTexSize1;
  uniform vec2 uTexSize2;
  uniform vec2 uTexSize3;
  uniform vec2 uTexSize4;

  uniform float uHdEnhance;

  uniform float uEnabled0;
  uniform float uEnabled1;
  uniform float uEnabled2;
  uniform float uEnabled3;
  uniform float uEnabled4;

  uniform float uOpacity0;
  uniform float uOpacity1;
  uniform float uOpacity2;
  uniform float uOpacity3;
  uniform float uOpacity4;

  uniform int uMode0;
  uniform int uMode1;
  uniform int uMode2;
  uniform int uMode3;
  uniform int uMode4;

  uniform float uHasTex0;
  uniform float uHasTex1;
  uniform float uHasTex2;
  uniform float uHasTex3;
  uniform float uHasTex4;

  uniform sampler2D uMaskTex;
  uniform float uHasMask;
  uniform float uMaskDim;
  uniform float uHighContrast;
  uniform float uFlatMix;
  uniform int uVisualStyle;

  varying vec2 vUv;
  varying vec3 vNormalDir;
  varying vec3 vWorldPos;

  // Hardware-accelerated 4-tap cubic B-spline reconstruction
  vec3 sampleBicubicBSpline(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 invSize = 1.0 / max(texSize, vec2(1.0));
    vec2 tc = uv * texSize - 0.5;
    vec2 f = fract(tc);
    vec2 i = tc - f;
    vec2 f2 = f * f;
    vec2 f3 = f2 * f;

    vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
    vec2 w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0;
    vec2 w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0;
    vec2 w3 = f3 / 6.0;

    vec2 s0 = w0 + w1;
    vec2 s1 = w2 + w3;
    vec2 t0 = (i - 0.5 + w1 / max(s0, vec2(1e-4))) * invSize;
    vec2 t1 = (i + 1.5 + w3 / max(s1, vec2(1e-4))) * invSize;

    vec3 a = texture2D(tex, vec2(t0.x, t0.y)).rgb;
    vec3 b = texture2D(tex, vec2(t1.x, t0.y)).rgb;
    vec3 c = texture2D(tex, vec2(t0.x, t1.y)).rgb;
    vec3 d = texture2D(tex, vec2(t1.x, t1.y)).rgb;

    return mix(mix(b, a, s0.x), mix(d, c, s0.x), s0.y);
  }

  // Bicubic upsampling + Clamped Contrast-Adaptive Sharpening (preserves NASA color telemetry)
  vec3 sampleVideoLayer(sampler2D tex, vec2 uv, vec2 texSize) {
    if (uHdEnhance < 0.5) {
      return texture2D(tex, uv).rgb;
    }
    vec2 inv = 1.0 / max(texSize, vec2(1.0));
    vec3 base = sampleBicubicBSpline(tex, uv, texSize);
    vec3 n = texture2D(tex, uv + vec2(0.0, inv.y)).rgb;
    vec3 s = texture2D(tex, uv - vec2(0.0, inv.y)).rgb;
    vec3 e = texture2D(tex, uv + vec2(inv.x, 0.0)).rgb;
    vec3 w = texture2D(tex, uv - vec2(inv.x, 0.0)).rgb;

    vec3 mn = min(base, min(min(n, s), min(e, w)));
    vec3 mx = max(base, max(max(n, s), max(e, w)));
    vec3 blur = (n + s + e + w) * 0.25;
    vec3 detail = base - blur;

    // Adaptive gain reduces haloing in high-contrast areas while sharpening atmospheric filaments
    vec3 contrast = max(mx - mn, vec3(1e-4));
    vec3 weight = clamp(vec3(1.0) - contrast * 0.65, 0.28, 0.92);
    return clamp(base + detail * weight * 1.35, mn, mx);
  }

  float overlayChan(float b, float t) {
    return b < 0.5 ? (2.0 * b * t) : (1.0 - 2.0 * (1.0 - b) * (1.0 - t));
  }

  vec3 applyBlend(vec3 base, vec3 top, float opacity, int mode) {
    vec3 result = top;
    if (mode == 1) {
      result = 1.0 - (1.0 - base) * (1.0 - top);
    } else if (mode == 2) {
      result = min(base + top, vec3(1.0));
    } else if (mode == 3) {
      result = base * top;
    } else if (mode == 4) {
      result = vec3(
        overlayChan(base.r, top.r),
        overlayChan(base.g, top.g),
        overlayChan(base.b, top.b)
      );
    } else if (mode == 5) {
      result = abs(base - top);
    }
    return mix(base, result, clamp(opacity, 0.0, 1.0));
  }

  void main() {
    vec3 color = vec3(0.04, 0.08, 0.16);
    bool hasAny = false;

    if (uEnabled0 > 0.5 && uHasTex0 > 0.5) {
      vec3 c0 = sampleVideoLayer(uTex0, vUv, uTexSize0);
      color = hasAny ? applyBlend(color, c0, uOpacity0, uMode0) : mix(color, c0, uOpacity0);
      hasAny = true;
    }
    if (uEnabled1 > 0.5 && uHasTex1 > 0.5) {
      vec3 c1 = sampleVideoLayer(uTex1, vUv, uTexSize1);
      color = hasAny ? applyBlend(color, c1, uOpacity1, uMode1) : mix(color, c1, uOpacity1);
      hasAny = true;
    }
    if (uEnabled2 > 0.5 && uHasTex2 > 0.5) {
      vec3 c2 = sampleVideoLayer(uTex2, vUv, uTexSize2);
      color = hasAny ? applyBlend(color, c2, uOpacity2, uMode2) : mix(color, c2, uOpacity2);
      hasAny = true;
    }
    if (uEnabled3 > 0.5 && uHasTex3 > 0.5) {
      vec3 c3 = sampleVideoLayer(uTex3, vUv, uTexSize3);
      color = hasAny ? applyBlend(color, c3, uOpacity3, uMode3) : mix(color, c3, uOpacity3);
      hasAny = true;
    }
    if (uEnabled4 > 0.5 && uHasTex4 > 0.5) {
      vec3 c4 = sampleVideoLayer(uTex4, vUv, uTexSize4);
      color = hasAny ? applyBlend(color, c4, uOpacity4, uMode4) : mix(color, c4, uOpacity4);
      hasAny = true;
    }

    // Generative Visual Art Styles (0: Bioluminescent, 1: Infrared, 2: Blueprint, 3: Satellite)
    if (hasAny && uHighContrast < 0.5) {
      float maxC = max(color.r, max(color.g, color.b));
      float minC = min(color.r, min(color.g, color.b));
      float chroma = maxC - minC;
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      float neutralLand = (1.0 - smoothstep(0.035, 0.11, chroma)) * smoothstep(0.32, 0.48, maxC);

      if (uVisualStyle == 0) {
        vec3 nightLand = vec3(0.036, 0.064, 0.132) + vec3(0.032, 0.052, 0.092) * lum;
        color = mix(color, nightLand, neutralLand * 0.92);
      } else if (uVisualStyle == 1) {
        // Orbital Infrared: false-color thermal gallery mapping
        vec3 baseNight = mix(color, vec3(0.05, 0.02, 0.11) + vec3(0.04, 0.01, 0.08) * lum, neutralLand * 0.9);
        float energy = clamp(lum * 0.65 + chroma * 1.15, 0.0, 1.0);
        vec3 cold = vec3(0.07, 0.03, 0.20);
        vec3 mid = vec3(0.78, 0.12, 0.38);
        vec3 hot = vec3(1.0, 0.78, 0.18);
        vec3 peak = vec3(1.0, 0.97, 0.88);
        vec3 thermal = energy < 0.45
          ? mix(cold, mid, energy / 0.45)
          : energy < 0.82
            ? mix(mid, hot, (energy - 0.45) / 0.37)
            : mix(hot, peak, (energy - 0.82) / 0.18);
        color = mix(baseNight, thermal, clamp(0.45 + chroma * 0.9, 0.0, 0.94));
      } else if (uVisualStyle == 2) {
        // Cartographic Blueprint: abyssal cyan observatory + golden signal peaks
        vec3 bpLand = vec3(0.02, 0.075, 0.145) + vec3(0.03, 0.11, 0.19) * lum;
        vec3 baseBp = mix(color, bpLand, neutralLand * 0.94);
        float sig = clamp(chroma * 1.35 + lum * 0.38, 0.0, 1.0);
        vec3 cyanInk = mix(vec3(0.02, 0.08, 0.16), vec3(0.16, 0.76, 0.98), smoothstep(0.08, 0.65, sig));
        vec3 goldPeak = mix(cyanInk, vec3(0.99, 0.82, 0.30), smoothstep(0.58, 0.94, sig));
        color = mix(baseBp, goldPeak, 0.82);
      } else {
        // Daylight Satellite: 100% pure NASA SVS colorimetry matching official colorbars
        color = clamp(color, 0.0, 1.0);
      }
    }

    // Highlight selected country via equirectangular mask, subtly softening surrounding context
    if (uHasMask > 0.5) {
      float maskVal = texture2D(uMaskTex, vUv).r;
      float factor = mix(uMaskDim, 1.0, maskVal);
      color *= factor;
    }

    // Subtle atmospheric Fresnel rim in 3D globe mode
    if (uFlatMix < 0.99) {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = 1.0 - max(dot(normalize(vNormalDir), viewDir), 0.0);
      float atmos = pow(rim, 3.0) * 0.34 * (1.0 - uFlatMix);
      color += vec3(0.20, 0.58, 0.98) * atmos;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const LINE_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aFlatPosition;
  uniform float uFlatMix;
  void main() {
    vec3 morphed = mix(position, aFlatPosition, uFlatMix);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(morphed, 1.0);
  }
`;

const LINE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

function wrapLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function shortestLonDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function getOrCreateVideoTexture(
  video: HTMLVideoElement,
  cache: Map<HTMLVideoElement, THREE.VideoTexture>
): THREE.VideoTexture {
  const existing = cache.get(video);
  if (existing) return existing;
  const tex = new THREE.VideoTexture(video);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  cache.set(video, tex);
  return tex;
}

export const EarthCanvas: React.FC<EarthCanvasProps> = ({
  videoElements,
  layers,
  viewMode,
  visualStyle = 'bioluminescent',
  orbitAutoRotate = true,
  autoRotateSpeedDegPerSec = 1.92,
  blueHighlightBoost = 0,
  onRegisterPosterCapture,
  showBorders,
  showGrid,
  showLabels,
  highContrast,
  hdEnhance = true,
  lang = 'pt',
  backgroundHex = '#020617',
  frameOffsetRatio = 0,
  availableCountryIds,
  countries,
  allRings,
  landBorderRings,
  coastlineRings,
  selectedCountry,
  jukeboxPlaying = false,
  motionPaused = false,
  interactive = true,
  flyTarget,
  zoomCommand,
  panCommand,
  onHoverChange,
  onCameraDistanceChange,
  onCameraCenterChange,
  onSelectCountry,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const fxOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const hoverLiveRef = useRef<HoverInfo | null>(null);

  const propsRef = useRef({
    videoElements,
    layers,
    viewMode,
    visualStyle,
    orbitAutoRotate,
    autoRotateSpeedDegPerSec,
    blueHighlightBoost,
    onRegisterPosterCapture,
    showBorders,
    showGrid,
    showLabels,
    highContrast,
    hdEnhance,
    lang,
    backgroundHex,
    frameOffsetRatio,
    availableCountryIds,
    countries,
    selectedCountry,
    jukeboxPlaying,
    motionPaused,
    onHoverChange,
    onCameraDistanceChange,
    onCameraCenterChange,
    onSelectCountry,
  });
  propsRef.current = {
    videoElements,
    layers,
    viewMode,
    visualStyle,
    orbitAutoRotate,
    autoRotateSpeedDegPerSec,
    blueHighlightBoost,
    onRegisterPosterCapture,
    showBorders,
    showGrid,
    showLabels,
    highContrast,
    hdEnhance,
    lang,
    backgroundHex,
    frameOffsetRatio,
    availableCountryIds,
    countries,
    selectedCountry,
    jukeboxPlaying,
    motionPaused,
    onHoverChange,
    onCameraDistanceChange,
    onCameraCenterChange,
    onSelectCountry,
  };

  const navRef = useRef({
    lon: -35,
    lat: 4,
    distance: 2.98,
    targetLon: -35,
    targetLat: 4,
    targetDistance: 2.98,
    flatMix: viewMode === '2d' ? 1 : 0,
    viewOffsetX: 0,
    isDragging: false,
    dragMoved: false,
    lastX: 0,
    lastY: 0,
    lastReportedDist: 2.98,
    lastReportedLon: -35,
    lastReportedLat: 4,
  });

  const uniformsRef = useRef<{
    earth: Record<string, THREE.IUniform>;
    borders: Record<string, THREE.IUniform>;
    highlight: Record<string, THREE.IUniform>;
    grid: Record<string, THREE.IUniform>;
  } | null>(null);

  const sceneRefs = useRef<{
    highlightLine: THREE.LineSegments | null;
    fallbackTex: THREE.DataTexture | null;
    maskTex: THREE.CanvasTexture | null;
    texCache: Map<HTMLVideoElement, THREE.VideoTexture>;
  }>({
    highlightLine: null,
    fallbackTex: null,
    maskTex: null,
    texCache: new Map(),
  });

  useEffect(() => {
    if (!flyTarget) return;
    const nav = navRef.current;
    const dLon = shortestLonDelta(nav.lon, flyTarget.lon);
    nav.targetLon = nav.lon + dLon;
    nav.targetLat = THREE.MathUtils.clamp(flyTarget.lat, -84, 84);
    nav.targetDistance = THREE.MathUtils.clamp(flyTarget.distance, 1.07, 3.8);
  }, [flyTarget]);

  useEffect(() => {
    if (!zoomCommand) return;
    const nav = navRef.current;
    nav.targetDistance = THREE.MathUtils.clamp(
      nav.targetDistance + zoomCommand.delta,
      1.07,
      3.8
    );
  }, [zoomCommand]);

  useEffect(() => {
    if (!panCommand) return;
    const nav = navRef.current;
    const altScale = Math.max(0.18, nav.distance - 0.96);
    nav.targetLon += panCommand.dLon * altScale;
    nav.targetLat = THREE.MathUtils.clamp(nav.targetLat + panCommand.dLat * altScale, -84, 84);
  }, [panCommand]);

  // Update highlighted country border geometry AND equirectangular darkening mask
  useEffect(() => {
    const line = sceneRefs.current.highlightLine;
    const earthUniforms = uniformsRef.current?.earth;

    if (sceneRefs.current.maskTex) {
      sceneRefs.current.maskTex.dispose();
      sceneRefs.current.maskTex = null;
    }

    if (!selectedCountry) {
      if (line) {
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry();
        line.visible = false;
      }
      if (earthUniforms) {
        earthUniforms.uHasMask.value = 0;
        earthUniforms.uMaskTex.value = sceneRefs.current.fallbackTex;
      }
      return;
    }

    if (line) {
      line.geometry.dispose();
      line.geometry = buildMorphLinesFromRings(
        selectedCountry.rings,
        GLOBE_RADIUS * 1.0045,
        FLAT_WIDTH,
        FLAT_HEIGHT,
        0.008
      );
      line.visible = true;
    }

    const maskTex = createCountryMaskTexture(
      selectedCountry.rings,
      2048,
      1024,
      selectedCountry.polygons
    );
    sceneRefs.current.maskTex = maskTex;
    if (earthUniforms && maskTex) {
      earthUniforms.uMaskTex.value = maskTex;
      earthUniforms.uHasMask.value = 1;
    }
  }, [selectedCountry]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(propsRef.current.backgroundHex);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      50
    );

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const starPositions = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const r = 12 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.045,
      transparent: true,
      opacity: 0.65,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Layer-reactive atmospheric obsidian particles (1:1 mapped to the 5 NASA map layers)
    const LAYER_ORBITAL_PALETTE: { id: DatasetId; hex: string }[] = [
      { id: 'svs5011', hex: '#FBBF24' }, // Melodia — Raios (Dourado)
      { id: 'svs5153', hex: '#FB923C' }, // Harmonia — CO (Laranja)
      { id: 'svs5147', hex: '#FB7185' }, // Ritmo — Temperatura (Coral/Rosa)
      { id: 'svs5154', hex: '#34D399' }, // Baixo — NO2 (Verde Esmeralda)
      { id: 'svs5148', hex: '#38BDF8' }, // Efeitos — Ventos (Azul Ciano)
    ];
    const atmoGroup = new THREE.Group();
    const atmoLayerClouds = LAYER_ORBITAL_PALETTE.map(({ id, hex }, layerIdx) => {
      const count = 76;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = GLOBE_RADIUS * (1.13 + ((i * 17 + layerIdx * 7) % 26) * 0.01);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: new THREE.Color(hex),
        size: 0.028,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.visible = false;
      atmoGroup.add(points);
      return {
        id,
        color: new THREE.Color(hex),
        geo,
        mat,
        points,
        fade: 0,
        spinSpeed: 0.0007 + layerIdx * 0.00014,
        tiltSpeed: (layerIdx % 2 === 0 ? 1 : -1) * 0.00018,
      };
    });
    scene.add(atmoGroup);

    const haloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.07, 48, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    scene.add(haloMesh);

    const fallbackTex = new THREE.DataTexture(new Uint8Array([10, 18, 36, 255]), 1, 1);
    fallbackTex.needsUpdate = true;
    sceneRefs.current.fallbackTex = fallbackTex;

    const earthUniforms: Record<string, THREE.IUniform> = {
      uTex0: { value: fallbackTex },
      uTex1: { value: fallbackTex },
      uTex2: { value: fallbackTex },
      uTex3: { value: fallbackTex },
      uTex4: { value: fallbackTex },
      uTexSize0: { value: new THREE.Vector2(2048, 1024) },
      uTexSize1: { value: new THREE.Vector2(2048, 1024) },
      uTexSize2: { value: new THREE.Vector2(2048, 1024) },
      uTexSize3: { value: new THREE.Vector2(2048, 1024) },
      uTexSize4: { value: new THREE.Vector2(2048, 1024) },
      uHdEnhance: { value: 1 },
      uEnabled0: { value: 0 },
      uEnabled1: { value: 0 },
      uEnabled2: { value: 0 },
      uEnabled3: { value: 0 },
      uEnabled4: { value: 0 },
      uOpacity0: { value: 1 },
      uOpacity1: { value: 1 },
      uOpacity2: { value: 1 },
      uOpacity3: { value: 1 },
      uOpacity4: { value: 1 },
      uMode0: { value: 0 },
      uMode1: { value: 0 },
      uMode2: { value: 0 },
      uMode3: { value: 0 },
      uMode4: { value: 0 },
      uHasTex0: { value: 0 },
      uHasTex1: { value: 0 },
      uHasTex2: { value: 0 },
      uHasTex3: { value: 0 },
      uHasTex4: { value: 0 },
      uMaskTex: { value: fallbackTex },
      uHasMask: { value: 0 },
      uMaskDim: { value: 0.25 },
      uHighContrast: { value: 0 },
      uFlatMix: { value: navRef.current.flatMix },
      uVisualStyle: { value: 0 },
    };

    const earthGeo = buildMorphEarthGeometry(192, 96, GLOBE_RADIUS, FLAT_WIDTH, FLAT_HEIGHT);
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      uniforms: earthUniforms,
      side: THREE.DoubleSide,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    const gridUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#6488cc') },
      uOpacity: { value: 0.14 },
    };
    const gridGeo = buildMorphGraticuleGeometry(30, 15);
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: gridUniforms,
      transparent: true,
      depthWrite: false,
    });
    const gridLine = new THREE.LineSegments(gridGeo, gridMat);
    gridLine.renderOrder = 1;
    scene.add(gridLine);

    // Dual-contrast cartographic border system:
    // 1. Dark casing (#020617) underneath so borders remain sharp over white/mint/yellow NASA maps
    // 2. Crisp coastlines (#cbd5e1) separating land from ocean
    // 3. High-contrast international land frontiers (#f8fafc) country by country
    const effectiveLandRings =
      landBorderRings && landBorderRings.length > 0 ? landBorderRings : allRings;
    const effectiveCoastRings = coastlineRings ?? [];

    const bordersGroup = new THREE.Group();

    const bordersCasingUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#020617') },
      uOpacity: { value: 0.62 },
    };
    const bordersCasingGeo = buildMorphLinesFromRings(
      effectiveLandRings,
      GLOBE_RADIUS * 1.0024,
      FLAT_WIDTH,
      FLAT_HEIGHT,
      0.0032
    );
    const bordersCasingMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: bordersCasingUniforms,
      transparent: true,
      depthWrite: false,
    });
    const bordersCasingLine = new THREE.LineSegments(bordersCasingGeo, bordersCasingMat);
    bordersCasingLine.renderOrder = 2;
    bordersGroup.add(bordersCasingLine);

    const coastlinesUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#cbd5e1') },
      uOpacity: { value: 0.38 },
    };
    const coastlinesGeo =
      effectiveCoastRings.length > 0
        ? buildMorphLinesFromRings(
            effectiveCoastRings,
            GLOBE_RADIUS * 1.0028,
            FLAT_WIDTH,
            FLAT_HEIGHT,
            0.0037
          )
        : new THREE.BufferGeometry();
    const coastlinesMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: coastlinesUniforms,
      transparent: true,
      depthWrite: false,
    });
    const coastlinesLine = new THREE.LineSegments(coastlinesGeo, coastlinesMat);
    coastlinesLine.renderOrder = 3;
    coastlinesLine.visible = effectiveCoastRings.length > 0;
    bordersGroup.add(coastlinesLine);

    const bordersUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#f8fafc') },
      uOpacity: { value: 0.68 },
    };
    const bordersGeo = buildMorphLinesFromRings(
      effectiveLandRings,
      GLOBE_RADIUS * 1.0033,
      FLAT_WIDTH,
      FLAT_HEIGHT,
      0.0043
    );
    const bordersMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: bordersUniforms,
      transparent: true,
      depthWrite: false,
    });
    const bordersLine = new THREE.LineSegments(bordersGeo, bordersMat);
    bordersLine.renderOrder = 4;
    bordersGroup.add(bordersLine);
    scene.add(bordersGroup);

    const highlightUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#6488cc') },
      uOpacity: { value: 1.0 },
    };
    const highlightMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: highlightUniforms,
      transparent: true,
      depthWrite: false,
    });
    const highlightLine = new THREE.LineSegments(new THREE.BufferGeometry(), highlightMat);
    highlightLine.renderOrder = 5;
    highlightLine.visible = false;
    scene.add(highlightLine);

    uniformsRef.current = {
      earth: earthUniforms,
      borders: bordersUniforms,
      highlight: highlightUniforms,
      grid: gridUniforms,
    };
    sceneRefs.current.highlightLine = highlightLine;

    const labelPool = countries;
    const labelDivs = new Map<string, HTMLDivElement>();
    const labelsLayer = labelsLayerRef.current;
    if (labelsLayer) {
      labelsLayer.innerHTML = '';
      for (const country of labelPool) {
        const el = document.createElement('div');
        el.className = 'map-country-label';
        el.textContent = country.namePt;
        el.style.opacity = '0';
        labelsLayer.appendChild(el);
        labelDivs.set(country.id, el);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const sphereBounds = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);
    const hitPoint = new THREE.Vector3();

    const computeLonLatFromPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);

      if (navRef.current.flatMix > 0.5) {
        const hit = raycaster.ray.intersectPlane(flatPlane, hitPoint);
        if (!hit) return null;
        if (Math.abs(hit.x) > FLAT_WIDTH * 0.5 || Math.abs(hit.y) > FLAT_HEIGHT * 0.5) {
          return null;
        }
        return flatPointToLonLat(hit, FLAT_WIDTH, FLAT_HEIGHT);
      } else {
        const hit = raycaster.ray.intersectSphere(sphereBounds, hitPoint);
        if (!hit) return null;
        return spherePointToLonLat(hit);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      navRef.current.isDragging = true;
      navRef.current.dragMoved = false;
      navRef.current.lastX = e.clientX;
      navRef.current.lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const nav = navRef.current;
      if (nav.isDragging) {
        const dx = e.clientX - nav.lastX;
        const dy = e.clientY - nav.lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          nav.dragMoved = true;
        }
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;

        const altitudeFactor = Math.max(0.08, nav.distance - 0.98);
        const degPerPx = 0.24 * altitudeFactor;
        nav.targetLon -= dx * degPerPx;
        nav.targetLat = THREE.MathUtils.clamp(nav.targetLat + dy * degPerPx, -84, 84);
      } else {
        const coords = computeLonLatFromPointer(e.clientX, e.clientY);
        if (!coords) {
          hoverLiveRef.current = null;
          propsRef.current.onHoverChange(null);
        } else {
          const proxDeg = Math.max(0.08, Math.min(0.32, (nav.distance - 1.0) * 0.22));
          const rawCountry = findCountryAtLonLat(
            coords.lon,
            coords.lat,
            propsRef.current.countries,
            proxDeg
          );
          const allowedSet = propsRef.current.availableCountryIds;
          const country =
            rawCountry && (!allowedSet || allowedSet.has(rawCountry.id)) ? rawCountry : null;
          const nextHover: HoverInfo = {
            lon: coords.lon,
            lat: coords.lat,
            country,
          };
          hoverLiveRef.current = nextHover;
          propsRef.current.onHoverChange(nextHover);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const nav = navRef.current;
      const wasClick = nav.isDragging && !nav.dragMoved;
      nav.isDragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }

      if (wasClick) {
        const coords = computeLonLatFromPointer(e.clientX, e.clientY);
        if (coords) {
          const proxDeg = Math.max(0.08, Math.min(0.32, (nav.distance - 1.0) * 0.22));
          const rawCountry = findCountryAtLonLat(
            coords.lon,
            coords.lat,
            propsRef.current.countries,
            proxDeg
          );
          const allowedSet = propsRef.current.availableCountryIds;
          const country =
            rawCountry && (!allowedSet || allowedSet.has(rawCountry.id)) ? rawCountry : null;
          if (country) {
            propsRef.current.onSelectCountry(country);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const nav = navRef.current;
      const zoomStep = e.deltaY * 0.0014 * Math.max(0.18, nav.targetDistance - 0.94);
      nav.targetDistance = THREE.MathUtils.clamp(nav.targetDistance + zoomStep, 1.07, 3.8);
    };

    const onDoubleClick = (e: MouseEvent) => {
      const coords = computeLonLatFromPointer(e.clientX, e.clientY);
      if (!coords) return;
      const nav = navRef.current;
      const dLon = shortestLonDelta(nav.lon, coords.lon);
      nav.targetLon = nav.lon + dLon;
      nav.targetLat = THREE.MathUtils.clamp(coords.lat, -84, 84);
      nav.targetDistance = THREE.MathUtils.clamp(
        1.0 + (nav.targetDistance - 1.0) * 0.55,
        1.07,
        3.8
      );
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const onPointerLeave = () => {
      hoverLiveRef.current = null;
      propsRef.current.onHoverChange(null);
    };

    const dom = renderer.domElement;
    dom.style.pointerEvents = interactive ? 'auto' : 'none';
    if (interactive) {
      dom.addEventListener('pointerdown', onPointerDown);
      dom.addEventListener('pointermove', onPointerMove);
      dom.addEventListener('pointerup', onPointerUp);
      dom.addEventListener('pointerleave', onPointerLeave);
      dom.addEventListener('wheel', onWheel, { passive: false });
      dom.addEventListener('dblclick', onDoubleClick);
    }
    window.addEventListener('resize', onResize);

    (window as unknown as Record<string, unknown>).__NASA_EARTH_DEBUG__ = {
      getCameraState: () => ({ ...navRef.current }),
      setCameraTarget: (lon: number, lat: number, distance: number) => {
        navRef.current.lon = lon;
        navRef.current.targetLon = lon;
        navRef.current.lat = lat;
        navRef.current.targetLat = lat;
        navRef.current.distance = distance;
        navRef.current.targetDistance = distance;
      },
    };

    propsRef.current.onRegisterPosterCapture?.(() => {
      renderer.render(scene, camera);
      return { glCanvas: renderer.domElement, fxCanvas: fxOverlayRef.current };
    });

    let rafId = 0;
    let lastFrameMs = performance.now();
    const tempSphereCam = new THREE.Vector3();
    const tempFlatCam = new THREE.Vector3();
    const tempLookAt = new THREE.Vector3();
    const tempLabelPos = new THREE.Vector3();
    const tempCamDir = new THREE.Vector3();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const nowFrameMs = performance.now();
      const dtSec = Math.min(0.12, Math.max(0.004, (nowFrameMs - lastFrameMs) / 1000));
      lastFrameMs = nowFrameMs;
      const smoothPos = 1 - Math.exp(-dtSec * 8.8);
      const smoothFlat = 1 - Math.exp(-dtSec * 7.8);

      const nav = navRef.current;
      const p = propsRef.current;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const motionAllowed = !p.motionPaused && !prefersReducedMotion;
      const orbitSpinAllowed = (p.orbitAutoRotate ?? true) && motionAllowed;

      // Gentle ambient orbital drift when idle in 3D globe mode
      if (
        orbitSpinAllowed &&
        !nav.isDragging &&
        !p.selectedCountry &&
        nav.flatMix < 0.05
      ) {
        nav.targetLon += (p.autoRotateSpeedDegPerSec ?? 1.92) * dtSec;
      }

      nav.lon += (nav.targetLon - nav.lon) * smoothPos;
      nav.lat += (nav.targetLat - nav.lat) * smoothPos;
      nav.distance += (nav.targetDistance - nav.distance) * smoothPos;

      if (Math.abs(nav.lon) > 360) {
        const normalized = wrapLon(nav.lon);
        const shift = normalized - nav.lon;
        nav.lon = normalized;
        nav.targetLon += shift;
      }

      const targetFlat = p.viewMode === '2d' ? 1 : 0;
      nav.flatMix += (targetFlat - nav.flatMix) * (prefersReducedMotion ? 1 : smoothFlat);
      if (Math.abs(targetFlat - nav.flatMix) < 0.002) nav.flatMix = targetFlat;

      if (Math.abs(nav.distance - nav.lastReportedDist) > 0.01) {
        nav.lastReportedDist = nav.distance;
        p.onCameraDistanceChange(nav.distance);
      }

      const normalizedLon = wrapLon(nav.lon);
      if (
        Math.abs(normalizedLon - nav.lastReportedLon) > 0.2 ||
        Math.abs(nav.lat - nav.lastReportedLat) > 0.2
      ) {
        nav.lastReportedLon = normalizedLon;
        nav.lastReportedLat = nav.lat;
        p.onCameraCenterChange?.(normalizedLon, nav.lat);
      }

      (scene.background as THREE.Color).set(p.backgroundHex);

      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      const desiredOffsetRatio = p.selectedCountry && w >= 960 ? p.frameOffsetRatio : 0.0;
      nav.viewOffsetX += (desiredOffsetRatio - nav.viewOffsetX) * smoothFlat;
      if (Math.abs(nav.viewOffsetX) > 0.001) {
        camera.setViewOffset(w, h, Math.round(w * nav.viewOffsetX), 0, w, h);
      } else {
        camera.clearViewOffset();
      }

      tempSphereCam.copy(lonLatToSphere(normalizedLon, nav.lat, nav.distance));
      const flatFocus = lonLatToFlat(normalizedLon, nav.lat, FLAT_WIDTH, FLAT_HEIGHT, 0);
      const clampedFlatX = THREE.MathUtils.clamp(
        flatFocus.x,
        -FLAT_WIDTH * 0.44,
        FLAT_WIDTH * 0.44
      );
      const flatCamZ = (nav.distance - 1.0) * 1.9 + 0.16;
      tempFlatCam.set(clampedFlatX, flatFocus.y, flatCamZ);

      camera.position.lerpVectors(tempSphereCam, tempFlatCam, nav.flatMix);
      tempLookAt.set(clampedFlatX * nav.flatMix, flatFocus.y * nav.flatMix, 0);
      camera.up.set(0, 1, 0);
      camera.lookAt(tempLookAt);

      earthUniforms.uFlatMix.value = nav.flatMix;
      bordersCasingUniforms.uFlatMix.value = nav.flatMix;
      coastlinesUniforms.uFlatMix.value = nav.flatMix;
      bordersUniforms.uFlatMix.value = nav.flatMix;
      highlightUniforms.uFlatMix.value = nav.flatMix;
      gridUniforms.uFlatMix.value = nav.flatMix;

      // High-contrast / mask / visual style adjustments
      earthUniforms.uHighContrast.value = p.highContrast ? 1.0 : 0.0;
      earthUniforms.uVisualStyle.value = VISUAL_STYLE_INDEX[p.visualStyle ?? 'satellite'];
      earthUniforms.uMaskDim.value = p.highContrast ? 0.22 : 0.42;
      (bordersCasingUniforms.uColor.value as THREE.Color).set('#020617');
      bordersCasingUniforms.uOpacity.value = p.highContrast ? 0.88 : 0.62;
      (coastlinesUniforms.uColor.value as THREE.Color).set(
        p.highContrast ? '#e2e8f0' : '#cbd5e1'
      );
      coastlinesUniforms.uOpacity.value = p.highContrast ? 0.72 : 0.38;
      (bordersUniforms.uColor.value as THREE.Color).set(p.highContrast ? '#ffffff' : '#f8fafc');
      bordersUniforms.uOpacity.value = p.highContrast
        ? 0.96
        : nav.flatMix > 0.45
          ? 0.76
          : p.selectedCountry
            ? 0.58
            : 0.66;
      (highlightUniforms.uColor.value as THREE.Color).set(
        p.highContrast ? '#facc15' : '#38bdf8'
      );

      // Bind up to 5 stacked layer uniforms bottom-to-top:
      // Rule: 1 active layer = 100% pure NASA opacity (1.0, normal); 2+ layers = bottom solid + upper blended
      earthUniforms.uHdEnhance.value = p.hdEnhance ? 1.0 : 0.0;
      const enabledCount = p.layers.reduce((acc, l) => acc + (l.enabled ? 1 : 0), 0);
      let seenEnabledBase = false;
      for (let i = 0; i < 5; i++) {
        const cfg = p.layers[i];
        if (!cfg) {
          earthUniforms[`uEnabled${i}`].value = 0;
          earthUniforms[`uHasTex${i}`].value = 0;
          continue;
        }
        const vid = p.videoElements[cfg.id] ?? null;
        const ready = Boolean(vid && vid.readyState >= 2);
        const isFirstEnabled = cfg.enabled && !seenEnabledBase;
        if (cfg.enabled) {
          seenEnabledBase = true;
        }
        const effectiveOpacity = enabledCount === 1 || isFirstEnabled ? 1.0 : cfg.opacity;
        const effectiveMode =
          enabledCount === 1 || isFirstEnabled ? 0 : BLEND_MODE_INDEX[cfg.blendMode];

        earthUniforms[`uEnabled${i}`].value = cfg.enabled ? 1.0 : 0.0;
        earthUniforms[`uOpacity${i}`].value = effectiveOpacity;
        earthUniforms[`uMode${i}`].value = effectiveMode;
        earthUniforms[`uHasTex${i}`].value = ready ? 1.0 : 0.0;
        if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
          (earthUniforms[`uTexSize${i}`].value as THREE.Vector2).set(
            vid.videoWidth,
            vid.videoHeight
          );
        }
        earthUniforms[`uTex${i}`].value = vid
          ? getOrCreateVideoTexture(vid, sceneRefs.current.texCache)
          : fallbackTex;
      }

      bordersGroup.visible = p.showBorders;
      gridLine.visible = p.showGrid;
      stars.visible = nav.flatMix < 0.85;

      // Layer-reactive orbiting colored obsidian particles & halo aura
      const pulseLevel = p.jukeboxPlaying
        ? 0.22 + 0.16 * Math.abs(Math.sin(nowFrameMs * 0.004))
        : 0;
      const visualActive = nav.flatMix < 0.35 && !p.highContrast;
      atmoGroup.visible = visualActive;
      haloMesh.visible = visualActive;
      if (visualActive) {
        const enabledLayerSet = new Set(p.layers.filter((l) => l.enabled).map((l) => l.id));
        const baseParticleOpacity = 0.56 + pulseLevel * 0.34;
        const baseParticleSize = 0.027 + pulseLevel * 0.018;
        let firstActiveColor: THREE.Color | null = null;

        for (const cloud of atmoLayerClouds) {
          const isLayerOn = enabledLayerSet.has(cloud.id);
          if (isLayerOn && !firstActiveColor) {
            firstActiveColor = cloud.color;
          }
          const targetFade = isLayerOn ? 1 : 0;
          cloud.fade += (targetFade - cloud.fade) * smoothFlat;
          if (Math.abs(targetFade - cloud.fade) < 0.005) {
            cloud.fade = targetFade;
          }
          cloud.points.visible = cloud.fade > 0.01;
          if (cloud.points.visible) {
            if (motionAllowed) {
              cloud.points.rotation.y += cloud.spinSpeed + pulseLevel * 0.0018;
              cloud.points.rotation.x += cloud.tiltSpeed;
            }
            cloud.mat.size = baseParticleSize;
            cloud.mat.opacity = Math.min(0.95, baseParticleOpacity * cloud.fade);
          }
        }

        const boost = Math.max(0, Math.min(1, p.blueHighlightBoost ?? 0));
        const idleBreath = boost > 0 && motionAllowed ? 0.5 + 0.5 * Math.sin(nowFrameMs * 0.0024) : 0;
        const haloTargetColor =
          enabledLayerSet.size === 1 && firstActiveColor && boost === 0
            ? firstActiveColor
            : new THREE.Color(0x38bdf8);
        haloMat.color.lerp(haloTargetColor, 0.08);
        haloMesh.scale.setScalar(1 + pulseLevel * 0.035 + boost * (0.015 + idleBreath * 0.025));
        const baseHaloOpacity = enabledLayerSet.size === 0 ? 0.02 : 0.055 + pulseLevel * 0.08;
        haloMat.opacity = Math.max(baseHaloOpacity, boost * (0.18 + idleBreath * 0.1));
      }

      // Update projected HTML country labels with progressive area-based LOD & character-width collision avoidance
      if (labelsLayer) {
        labelsLayer.style.display = p.showLabels ? 'block' : 'none';
        if (p.showLabels) {
          tempCamDir.copy(camera.position).normalize();
          const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
          const charW = p.highContrast ? 7.4 : 5.3;
          const halfH = p.highContrast ? 9.5 : 6.2;
          const hoveredId = hoverLiveRef.current?.country?.id ?? null;
          const effectiveDist = nav.distance - nav.flatMix * 0.45;
          const minKm2 =
            effectiveDist > 2.45
              ? 150_000
              : effectiveDist > 2.0
                ? 48_000
                : effectiveDist > 1.6
                  ? 8_500
                  : effectiveDist > 1.28
                    ? 600
                    : 0;
          const labelSphereR = GLOBE_RADIUS * 1.01;

          // Sort: selected country first, hovered country second, inhabited nations before minor coral/polar islands, then descending real area
          const orderedLabels = [...labelPool].sort((a, b) => {
            if (p.selectedCountry?.id === a.id) return -1;
            if (p.selectedCountry?.id === b.id) return 1;
            if (hoveredId === a.id) return -1;
            if (hoveredId === b.id) return 1;
            if (Boolean(a.isMinorUninhabited) !== Boolean(b.isMinorUninhabited)) {
              return a.isMinorUninhabited ? 1 : -1;
            }
            return b.areaApproxKm2 - a.areaApproxKm2;
          });

          for (const country of orderedLabels) {
            const el = labelDivs.get(country.id);
            if (!el) continue;

            const isSelected = p.selectedCountry?.id === country.id;
            const isHovered = hoveredId === country.id;
            const isAvailable = !p.availableCountryIds || p.availableCountryIds.has(country.id);
            const displayName = p.lang === 'en' ? country.nameEn : country.namePt;
            if (el.textContent !== displayName) {
              el.textContent = displayName;
            }

            if (
              (!isAvailable || country.isMinorUninhabited) &&
              !isSelected &&
              !isHovered &&
              nav.distance > 1.18
            ) {
              el.style.opacity = '0';
              continue;
            }

            if (!isSelected && !isHovered && country.areaApproxKm2 < minKm2) {
              el.style.opacity = '0';
              continue;
            }

            const sPos = lonLatToSphere(country.lon, country.lat, labelSphereR);
            const fPos = lonLatToFlat(country.lon, country.lat, FLAT_WIDTH, FLAT_HEIGHT, 0.01);
            tempLabelPos.lerpVectors(sPos, fPos, nav.flatMix);

            if (nav.flatMix < 0.5) {
              const dot =
                (sPos.x * tempCamDir.x + sPos.y * tempCamDir.y + sPos.z * tempCamDir.z) /
                labelSphereR;
              if (dot < 0.34) {
                el.style.opacity = '0';
                continue;
              }
            }

            tempLabelPos.project(camera);
            if (tempLabelPos.z > 1 || tempLabelPos.z < -1) {
              el.style.opacity = '0';
              continue;
            }

            const sx = (tempLabelPos.x * 0.5 + 0.5) * w;
            const sy = (-tempLabelPos.y * 0.5 + 0.5) * h;

            if (sx < -40 || sx > w + 40 || sy < -20 || sy > h + 20) {
              el.style.opacity = '0';
              continue;
            }

            const halfW = Math.max(13, displayName.length * charW * 0.48 + 4);
            const pxPerDegApprox = h / (Math.max(0.22, nav.distance - 0.95) * 48);
            const polyHeightPx = country.latSpan * pxPerDegApprox;
            const candidateDys =
              !isSelected && polyHeightPx >= 22 ? [0, 10, -10] : [0];

            let placedSy: number | null = null;
            let chosenBox: { x1: number; y1: number; x2: number; y2: number } | null = null;
            for (const dy of candidateDys) {
              const testSy = sy + dy;
              const box = {
                x1: sx - halfW,
                y1: testSy - halfH,
                x2: sx + halfW,
                y2: testSy + halfH,
              };
              const hit =
                !isSelected &&
                placedBoxes.some(
                  (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
                );
              if (!hit) {
                placedSy = testSy;
                chosenBox = box;
                break;
              }
            }

            if (placedSy === null || !chosenBox) {
              el.style.opacity = '0';
              continue;
            }
            placedBoxes.push(chosenBox);

            el.style.transform = `translate3d(${sx.toFixed(1)}px, ${placedSy.toFixed(1)}px, 0) translate(-50%, -50%)`;
            const baseOpacity = p.selectedCountry ? 0.66 : nav.distance < 2.2 ? 0.9 : 0.74;
            el.style.opacity = isSelected || isHovered ? '1' : String(baseOpacity);
            el.classList.toggle('is-selected', isSelected);
            el.classList.toggle('is-hovered', isHovered && !isSelected);
          }
        }
      }

      renderer.render(scene, camera);

      const fxCanvas = fxOverlayRef.current;
      if (fxCanvas) {
        const fxCtx = fxCanvas.getContext('2d');
        if (fxCtx && (fxCanvas.width > 0 || fxCanvas.height > 0)) {
          fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        }
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      propsRef.current.onRegisterPosterCapture?.(null);
      if (interactive) {
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('pointermove', onPointerMove);
        dom.removeEventListener('pointerup', onPointerUp);
        dom.removeEventListener('pointerleave', onPointerLeave);
        dom.removeEventListener('wheel', onWheel);
        dom.removeEventListener('dblclick', onDoubleClick);
      }
      window.removeEventListener('resize', onResize);

      earthGeo.dispose();
      earthMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      bordersCasingGeo.dispose();
      bordersCasingMat.dispose();
      coastlinesGeo.dispose();
      coastlinesMat.dispose();
      bordersGeo.dispose();
      bordersMat.dispose();
      highlightLine.geometry.dispose();
      highlightMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      for (const cloud of atmoLayerClouds) {
        cloud.geo.dispose();
        cloud.mat.dispose();
      }
      haloGeo.dispose();
      haloMat.dispose();
      fallbackTex.dispose();
      sceneRefs.current.maskTex?.dispose();
      for (const tex of sceneRefs.current.texCache.values()) {
        tex.dispose();
      }
      sceneRefs.current.texCache.clear();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, [allRings, coastlineRings, countries, interactive, landBorderRings]);

  return (
    <div
      ref={containerRef}
      className="earth-canvas-root"
      role={interactive ? 'application' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={interactive ? undefined : { pointerEvents: 'none' }}
      aria-label={
        interactive
          ? 'Mapa interativo 3D e 2D da Terra com camadas da NASA. Use as setas do teclado para mover, mais e menos para zoom, Espaço para reproduzir ou pausar, J para Jukebox musical, E para explicação da música, V para narração por voz e R para ler os dados do local.'
          : undefined
      }
      aria-hidden={interactive ? undefined : true}
    >
      <canvas ref={fxOverlayRef} className="earth-fx-overlay" aria-hidden="true" />
      <div ref={labelsLayerRef} className="earth-labels-layer" aria-hidden="true" />
    </div>
  );
};
