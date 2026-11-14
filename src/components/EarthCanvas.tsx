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
import { createUnlockIlluminationTexture } from '../geo/unlockMapTexture';
import { BlendMode, DatasetId, LayerConfig } from '../datasets/nasaDatasets';
import { CommunityUnlockState, STEM_METAS, STEM_ORDER, StemId } from '../community/unlockStore';
import {
  AudioReactiveFrame,
  EMPTY_AUDIO_FRAME,
  SoundscapeVisualTelemetry,
} from '../audio/soundscapeEngine';

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

export interface RadiusTargetConfig {
  centerLon: number;
  centerLat: number;
  radiusKm: number;
}

interface EarthCanvasProps {
  videoElements: Partial<Record<DatasetId, HTMLVideoElement | null>>;
  layers: LayerConfig[];
  viewMode: '3d' | '2d';
  showBorders: boolean;
  showGrid: boolean;
  showLabels: boolean;
  highContrast: boolean;
  hdEnhance?: boolean;
  countries: CountryEntry[];
  allRings: number[][][];
  selectedCountry: CountryEntry | null;
  selectionMode?: 'country' | 'radius';
  radiusTarget?: RadiusTargetConfig | null;
  onPickRadiusCenter?: (lon: number, lat: number) => void;
  showUnlockMap?: boolean;
  unlockState?: CommunityUnlockState;
  soundscapeTelemetry?: SoundscapeVisualTelemetry | null;
  jukeboxPlaying?: boolean;
  audibleStems?: Record<StemId, boolean>;
  getAudioReactiveBands?: () => AudioReactiveFrame;
  motionPaused?: boolean;
  isCelebrating5of5?: boolean;
  unlockPulseNonce?: number;
  flyTarget: CameraViewTarget | null;
  zoomCommand?: { delta: number; nonce: number } | null;
  panCommand?: { dLon: number; dLat: number; nonce: number } | null;
  onHoverChange: (info: HoverInfo | null) => void;
  onCameraDistanceChange: (distance: number) => void;
  onCameraCenterChange?: (lon: number, lat: number) => void;
  onSelectCountry: (country: CountryEntry | null) => void;
}

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
  uniform sampler2D uUnlockTex;
  uniform float uHasUnlockTex;
  uniform float uShowUnlockMap;
  uniform float uHighContrast;
  uniform float uFlatMix;

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

    // Nocturnal bioluminescent grading: transform chalk-grey basemap land into deep obsidian-indigo
    // while keeping 100% of colorful NASA atmospheric plumes and lightning telemetry intact.
    if (hasAny && uHighContrast < 0.5) {
      float maxC = max(color.r, max(color.g, color.b));
      float minC = min(color.r, min(color.g, color.b));
      float chroma = maxC - minC;
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      float neutralLand = (1.0 - smoothstep(0.035, 0.11, chroma)) * smoothstep(0.32, 0.48, maxC);
      vec3 nightLand = vec3(0.036, 0.064, 0.132) + vec3(0.032, 0.052, 0.092) * lum;
      color = mix(color, nightLand, neutralLand * 0.92);
    }

    // Highlight selected country via equirectangular mask, darkening the rest of the world
    if (uHasMask > 0.5) {
      float maskVal = texture2D(uMaskTex, vUv).r;
      float factor = mix(uMaskDim, 1.0, maskVal);
      color *= factor;
    }

    // Collective Unlock / Illumination Map layer: lights up 1/5 -> 5/5 unlocked regions
    if (uShowUnlockMap > 0.5 && uHasUnlockTex > 0.5) {
      vec4 unlockCol = texture2D(uUnlockTex, vUv);
      if (unlockCol.a > 0.02) {
        color = mix(color, color * 0.62 + unlockCol.rgb * 1.25, clamp(unlockCol.a * 1.4, 0.0, 0.82));
      } else if (uHasMask < 0.5) {
        color *= 0.52;
      }
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
  showBorders,
  showGrid,
  showLabels,
  highContrast,
  hdEnhance = true,
  countries,
  allRings,
  selectedCountry,
  selectionMode = 'country',
  radiusTarget = null,
  onPickRadiusCenter,
  showUnlockMap = true,
  unlockState,
  soundscapeTelemetry = null,
  jukeboxPlaying = false,
  audibleStems,
  getAudioReactiveBands,
  motionPaused = false,
  isCelebrating5of5 = false,
  unlockPulseNonce = 0,
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
  const lastUnlockPulseRef = useRef({ nonce: unlockPulseNonce, startedAtMs: 0 });

  const propsRef = useRef({
    videoElements,
    layers,
    viewMode,
    showBorders,
    showGrid,
    showLabels,
    highContrast,
    hdEnhance,
    countries,
    selectedCountry,
    selectionMode,
    radiusTarget,
    onPickRadiusCenter,
    showUnlockMap,
    unlockState,
    soundscapeTelemetry,
    jukeboxPlaying,
    audibleStems,
    getAudioReactiveBands,
    motionPaused,
    isCelebrating5of5,
    unlockPulseNonce,
    onHoverChange,
    onCameraDistanceChange,
    onCameraCenterChange,
    onSelectCountry,
  });
  propsRef.current = {
    videoElements,
    layers,
    viewMode,
    showBorders,
    showGrid,
    showLabels,
    highContrast,
    hdEnhance,
    countries,
    selectedCountry,
    selectionMode,
    radiusTarget,
    onPickRadiusCenter,
    showUnlockMap,
    unlockState,
    soundscapeTelemetry,
    jukeboxPlaying,
    audibleStems,
    getAudioReactiveBands,
    motionPaused,
    isCelebrating5of5,
    unlockPulseNonce,
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
    unlockTex: THREE.CanvasTexture | null;
    texCache: Map<HTMLVideoElement, THREE.VideoTexture>;
  }>({
    highlightLine: null,
    fallbackTex: null,
    maskTex: null,
    unlockTex: null,
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

    const maskTex = createCountryMaskTexture(selectedCountry.rings, 4096, 2048);
    sceneRefs.current.maskTex = maskTex;
    if (earthUniforms && maskTex) {
      earthUniforms.uMaskTex.value = maskTex;
      earthUniforms.uHasMask.value = 1;
    }
  }, [selectedCountry]);

  // Update Collective Unlock / Illumination Map texture whenever community contributions change
  useEffect(() => {
    const earthUniforms = uniformsRef.current?.earth;
    if (sceneRefs.current.unlockTex) {
      sceneRefs.current.unlockTex.dispose();
      sceneRefs.current.unlockTex = null;
    }
    if (!unlockState || !showUnlockMap) {
      if (earthUniforms) {
        earthUniforms.uHasUnlockTex.value = 0;
        earthUniforms.uUnlockTex.value = sceneRefs.current.fallbackTex;
      }
      return;
    }
    const uTex = createUnlockIlluminationTexture(countries, unlockState, 2048, 1024);
    sceneRefs.current.unlockTex = uTex;
    if (earthUniforms && uTex) {
      earthUniforms.uUnlockTex.value = uTex;
      earthUniforms.uHasUnlockTex.value = 1;
    }
  }, [countries, unlockState, showUnlockMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      50
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
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

    // Atmospheric audio-reactive particle aura (5 NASA stem colors orbiting the globe)
    const STEM_PALETTE = [
      new THREE.Color('#FBBF24'),
      new THREE.Color('#FB923C'),
      new THREE.Color('#FB7185'),
      new THREE.Color('#34D399'),
      new THREE.Color('#38BDF8'),
    ];
    const atmoCount = 340;
    const atmoPos = new Float32Array(atmoCount * 3);
    const atmoCol = new Float32Array(atmoCount * 3);
    for (let i = 0; i < atmoCount; i++) {
      const r = GLOBE_RADIUS * (1.14 + Math.random() * 0.24);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      atmoPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      atmoPos[i * 3 + 1] = r * Math.cos(phi);
      atmoPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const col = STEM_PALETTE[i % STEM_PALETTE.length];
      atmoCol[i * 3] = col.r;
      atmoCol[i * 3 + 1] = col.g;
      atmoCol[i * 3 + 2] = col.b;
    }
    const atmoGeo = new THREE.BufferGeometry();
    atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPos, 3));
    atmoGeo.setAttribute('color', new THREE.BufferAttribute(atmoCol, 3));
    const atmoMat = new THREE.PointsMaterial({
      size: 0.026,
      vertexColors: true,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const atmoPoints = new THREE.Points(atmoGeo, atmoMat);
    scene.add(atmoPoints);

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
      uUnlockTex: { value: fallbackTex },
      uHasUnlockTex: { value: 0 },
      uShowUnlockMap: { value: 1 },
      uHighContrast: { value: 0 },
      uFlatMix: { value: navRef.current.flatMix },
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
    scene.add(gridLine);

    const bordersUniforms: Record<string, THREE.IUniform> = {
      uFlatMix: { value: navRef.current.flatMix },
      uColor: { value: new THREE.Color('#e2e8f0') },
      uOpacity: { value: 0.45 },
    };
    const bordersGeo = buildMorphLinesFromRings(allRings);
    const bordersMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: bordersUniforms,
      transparent: true,
      depthWrite: false,
    });
    const bordersLine = new THREE.LineSegments(bordersGeo, bordersMat);
    scene.add(bordersLine);

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
          propsRef.current.onHoverChange(null);
        } else {
          const country = findCountryAtLonLat(
            coords.lon,
            coords.lat,
            propsRef.current.countries
          );
          propsRef.current.onHoverChange({
            lon: coords.lon,
            lat: coords.lat,
            country,
          });
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
          if (
            propsRef.current.selectionMode === 'radius' &&
            propsRef.current.onPickRadiusCenter
          ) {
            propsRef.current.onPickRadiusCenter(coords.lon, coords.lat);
          } else {
            const country = findCountryAtLonLat(
              coords.lon,
              coords.lat,
              propsRef.current.countries
            );
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

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('resize', onResize);

    (window as unknown as Record<string, unknown>).__NASA_EARTH_DEBUG__ = {
      getCameraState: () => ({ ...navRef.current }),
    };

    let rafId = 0;
    const tempSphereCam = new THREE.Vector3();
    const tempFlatCam = new THREE.Vector3();
    const tempLookAt = new THREE.Vector3();
    const tempLabelPos = new THREE.Vector3();
    const tempCamDir = new THREE.Vector3();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const nav = navRef.current;
      const p = propsRef.current;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const motionAllowed = !p.motionPaused && !prefersReducedMotion;

      // Gentle ambient orbital drift when idle in 3D globe mode
      if (
        motionAllowed &&
        !nav.isDragging &&
        !p.selectedCountry &&
        !p.radiusTarget &&
        nav.flatMix < 0.05
      ) {
        nav.targetLon += 0.032;
      }

      nav.lon += (nav.targetLon - nav.lon) * 0.14;
      nav.lat += (nav.targetLat - nav.lat) * 0.14;
      nav.distance += (nav.targetDistance - nav.distance) * 0.14;

      if (Math.abs(nav.lon) > 360) {
        const normalized = wrapLon(nav.lon);
        const shift = normalized - nav.lon;
        nav.lon = normalized;
        nav.targetLon += shift;
      }

      const targetFlat = p.viewMode === '2d' ? 1 : 0;
      nav.flatMix += (targetFlat - nav.flatMix) * 0.12;
      if (Math.abs(targetFlat - nav.flatMix) < 0.0005) nav.flatMix = targetFlat;

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

      // Smoothly shift viewport frustum so selected country or radius lands on the left side when right card opens
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      const desiredOffsetRatio = (p.selectedCountry || p.radiusTarget) && w >= 960 ? 0.115 : 0.0;
      nav.viewOffsetX += (desiredOffsetRatio - nav.viewOffsetX) * 0.12;
      if (Math.abs(nav.viewOffsetX) > 0.001) {
        camera.setViewOffset(w, h, Math.round(w * nav.viewOffsetX), 0, w, h);
      } else {
        camera.clearViewOffset();
      }

      tempSphereCam.copy(lonLatToSphere(normalizedLon, nav.lat, nav.distance));
      const flatFocus = lonLatToFlat(normalizedLon, nav.lat, FLAT_WIDTH, FLAT_HEIGHT, 0);
      const flatCamZ = (nav.distance - 1.0) * 1.9 + 0.16;
      tempFlatCam.set(flatFocus.x, flatFocus.y, flatCamZ);

      camera.position.lerpVectors(tempSphereCam, tempFlatCam, nav.flatMix);
      tempLookAt.set(flatFocus.x * nav.flatMix, flatFocus.y * nav.flatMix, 0);
      camera.up.set(0, 1, 0);
      camera.lookAt(tempLookAt);

      earthUniforms.uFlatMix.value = nav.flatMix;
      bordersUniforms.uFlatMix.value = nav.flatMix;
      highlightUniforms.uFlatMix.value = nav.flatMix;
      gridUniforms.uFlatMix.value = nav.flatMix;

      // High-contrast / mask adjustments
      earthUniforms.uHighContrast.value = p.highContrast ? 1.0 : 0.0;
      earthUniforms.uMaskDim.value = p.highContrast ? 0.14 : 0.24;
      earthUniforms.uShowUnlockMap.value = p.showUnlockMap ? 1.0 : 0.0;
      (bordersUniforms.uColor.value as THREE.Color).set(p.highContrast ? '#ffffff' : '#7dd3fc');
      bordersUniforms.uOpacity.value = p.highContrast
        ? 0.8
        : p.selectedCountry
          ? 0.24
          : 0.36;
      (highlightUniforms.uColor.value as THREE.Color).set(
        p.highContrast ? '#facc15' : '#38bdf8'
      );

      // Bind up to 5 stacked layer uniforms bottom-to-top
      earthUniforms.uHdEnhance.value = p.hdEnhance ? 1.0 : 0.0;
      for (let i = 0; i < 5; i++) {
        const cfg = p.layers[i];
        if (!cfg) {
          earthUniforms[`uEnabled${i}`].value = 0;
          earthUniforms[`uHasTex${i}`].value = 0;
          continue;
        }
        const vid = p.videoElements[cfg.id] ?? null;
        const ready = Boolean(vid && vid.readyState >= 2);
        earthUniforms[`uEnabled${i}`].value = cfg.enabled ? 1.0 : 0.0;
        earthUniforms[`uOpacity${i}`].value = cfg.opacity;
        earthUniforms[`uMode${i}`].value = BLEND_MODE_INDEX[cfg.blendMode];
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

      bordersLine.visible = p.showBorders;
      gridLine.visible = p.showGrid;
      stars.visible = nav.flatMix < 0.85;

      // Audio-reactive atmospheric particles & halo aura driven by real AnalyserNode bands
      const audioFrame = p.jukeboxPlaying && p.getAudioReactiveBands
        ? p.getAudioReactiveBands()
        : EMPTY_AUDIO_FRAME;
      const visualActive = nav.flatMix < 0.35 && !p.highContrast;
      atmoPoints.visible = visualActive;
      haloMesh.visible = visualActive;
      if (visualActive) {
        const celebrating = Boolean(p.isCelebrating5of5);
        if (motionAllowed) {
          atmoPoints.rotation.y += (celebrating ? 0.0014 : 0.0008) + audioFrame.highFreq * 0.0028;
          atmoPoints.rotation.x += 0.0002;
        }
        atmoMat.size = (celebrating ? 0.032 : 0.024) + audioFrame.highFreq * 0.024;
        atmoMat.opacity = (celebrating ? 0.54 : 0.36) + audioFrame.rms * 0.42;
        const targetColorHex = celebrating ? 0xfbbf24 : 0x38bdf8;
        haloMat.color.lerp(new THREE.Color(targetColorHex), 0.08);
        const haloScale = (celebrating ? 1.02 : 1) + audioFrame.subBass * 0.055;
        haloMesh.scale.setScalar(haloScale);
        haloMat.opacity = (celebrating ? 0.11 : 0.05) + audioFrame.lowMid * 0.11;
      }

      // Update projected HTML country labels with collision avoidance & smaller default sizing
      if (labelsLayer) {
        labelsLayer.style.display = p.showLabels ? 'block' : 'none';
        if (p.showLabels) {
          tempCamDir.copy(camera.position).normalize();
          const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
          const padX = p.highContrast ? 38 : 26;
          const padY = p.highContrast ? 14 : 9;

          // Sort so selected country is placed first, then larger countries
          const orderedLabels = [...labelPool].sort((a, b) => {
            if (p.selectedCountry?.id === a.id) return -1;
            if (p.selectedCountry?.id === b.id) return 1;
            return b.lonSpan * b.latSpan - a.lonSpan * a.latSpan;
          });

          for (const country of orderedLabels) {
            const el = labelDivs.get(country.id);
            if (!el) continue;

            const isSelected = p.selectedCountry?.id === country.id;
            const areaApprox = country.lonSpan * country.latSpan;
            const minAreaForZoom =
              nav.distance > 2.3 ? 42 : nav.distance > 1.75 ? 14 : nav.distance > 1.35 ? 3 : 0;

            if (!isSelected && areaApprox < minAreaForZoom) {
              el.style.opacity = '0';
              continue;
            }

            const sPos = lonLatToSphere(country.lon, country.lat, GLOBE_RADIUS * 1.01);
            const fPos = lonLatToFlat(country.lon, country.lat, FLAT_WIDTH, FLAT_HEIGHT, 0.01);
            tempLabelPos.lerpVectors(sPos, fPos, nav.flatMix);

            if (nav.flatMix < 0.5) {
              const dot = sPos.clone().normalize().dot(tempCamDir);
              if (dot < 0.36) {
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

            // Simple screen-space collision avoidance so labels never overlap
            const box = {
              x1: sx - padX,
              y1: sy - padY,
              x2: sx + padX,
              y2: sy + padY,
            };
            const collides =
              !isSelected &&
              placedBoxes.some(
                (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
              );

            if (collides) {
              el.style.opacity = '0';
              continue;
            }
            placedBoxes.push(box);

            el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
            const baseOpacity = p.selectedCountry ? 0.38 : nav.distance < 2.2 ? 0.84 : 0.62;
            el.style.opacity = isSelected ? '1' : String(baseOpacity);
            el.classList.toggle('is-selected', isSelected);
          }
        }
      }

      renderer.render(scene, camera);

      // Draw 1:1 Musical Visual Backing (reticles, isolines, beat rings, bass contours, wind & radius ring)
      const fxCanvas = fxOverlayRef.current;
      if (fxCanvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.max(1, Math.round(w * dpr));
        const targetH = Math.max(1, Math.round(h * dpr));
        if (fxCanvas.width !== targetW || fxCanvas.height !== targetH) {
          fxCanvas.width = targetW;
          fxCanvas.height = targetH;
        }
        const fxCtx = fxCanvas.getContext('2d');
        if (fxCtx) {
          fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          fxCtx.clearRect(0, 0, w, h);

          const projectGeo = (lon: number, lat: number, alt = 0.014): { x: number; y: number } | null => {
            const sPos = lonLatToSphere(lon, lat, GLOBE_RADIUS + alt);
            if (nav.flatMix < 0.5) {
              if (sPos.clone().normalize().dot(tempCamDir) < 0.22) return null;
            }
            const fPos = lonLatToFlat(lon, lat, FLAT_WIDTH, FLAT_HEIGHT, alt);
            tempLabelPos.lerpVectors(sPos, fPos, nav.flatMix);
            tempLabelPos.project(camera);
            if (tempLabelPos.z > 1 || tempLabelPos.z < -1) return null;
            return {
              x: (tempLabelPos.x * 0.5 + 0.5) * w,
              y: (-tempLabelPos.y * 0.5 + 0.5) * h,
            };
          };

          const drawPill = (x: number, y: number, text: string, strokeHex: string, fillHex = 'rgba(5, 11, 24, 0.9)') => {
            fxCtx.font = '700 10px "Space Grotesk", sans-serif';
            const tw = fxCtx.measureText(text).width;
            const pw = tw + 10;
            const ph = 17;
            fxCtx.fillStyle = fillHex;
            fxCtx.strokeStyle = strokeHex;
            fxCtx.lineWidth = 1;
            fxCtx.fillRect(x + 9, y - ph * 0.5, pw, ph);
            fxCtx.strokeRect(x + 9, y - ph * 0.5, pw, ph);
            fxCtx.fillStyle = strokeHex;
            fxCtx.textBaseline = 'middle';
            fxCtx.fillText(text, x + 14, y);
          };

          const nowMs = performance.now();

          // 0. Collective 3D Planetary Beacons (visible in global view when showUnlockMap is active)
          if (p.showUnlockMap && p.unlockState && !p.selectedCountry && !p.radiusTarget) {
            const regionRecords = Object.values(p.unlockState.regions);
            fxCtx.save();
            for (const rec of regionRecords) {
              if (!rec.regionKey.startsWith('country:')) continue;
              const countryId = rec.regionKey.slice(8);
              const c = p.countries.find((item) => item.id === countryId);
              if (!c) continue;
              const unlockedCount = STEM_ORDER.filter((s) => Boolean(rec.contributions[s])).length;
              if (unlockedCount === 0) continue;

              const pt = projectGeo(c.lon, c.lat, 0.008);
              if (!pt) continue;

              const isFull = unlockedCount >= 5;
              const breath = p.motionPaused ? 0 : 0.5 + 0.5 * Math.sin(nowMs * 0.0028 + c.lon * 0.1);
              const baseR = isFull ? 13 : 10.5;

              // Soft outer halo
              fxCtx.beginPath();
              fxCtx.arc(pt.x, pt.y, baseR + 4 + breath * 3.5, 0, Math.PI * 2);
              fxCtx.strokeStyle = p.highContrast
                ? '#facc15'
                : isFull
                  ? `rgba(251, 191, 36, ${(0.22 + breath * 0.25).toFixed(2)})`
                  : `rgba(56, 189, 248, ${(0.16 + breath * 0.18).toFixed(2)})`;
              fxCtx.lineWidth = 1.2;
              fxCtx.stroke();

              // 5-segment orbital ring representing the 5 voices
              const segSpan = (Math.PI * 2) / 5;
              const gap = 0.14;
              for (let idx = 0; idx < 5; idx++) {
                const stemId = STEM_ORDER[idx];
                const isLit = Boolean(rec.contributions[stemId]);
                const startA = -Math.PI * 0.5 + idx * segSpan + gap * 0.5;
                const endA = startA + segSpan - gap;
                fxCtx.beginPath();
                fxCtx.arc(pt.x, pt.y, baseR, startA, endA);
                fxCtx.strokeStyle = p.highContrast
                  ? isLit
                    ? '#facc15'
                    : 'rgba(255,255,255,0.28)'
                  : isLit
                    ? STEM_METAS[stemId].accentHex
                    : 'rgba(148, 163, 184, 0.28)';
                fxCtx.lineWidth = isLit ? 2.4 : 1.4;
                fxCtx.stroke();
              }

              // Center luminous core
              fxCtx.beginPath();
              fxCtx.arc(pt.x, pt.y, isFull ? 3.4 : 2.6, 0, Math.PI * 2);
              fxCtx.fillStyle = p.highContrast
                ? '#ffffff'
                : isFull
                  ? '#fbbf24'
                  : '#38bdf8';
              fxCtx.fill();

              // Compact beacon crown badge centered above the 5-segment ring (zero collision with map labels)
              const badgeText = p.showLabels
                ? isFull
                  ? '5/5 ★ Sinfonia'
                  : `${unlockedCount}/5 vozes`
                : isFull
                  ? `${c.namePt} · 5/5 ★`
                  : `${c.namePt} · ${unlockedCount}/5`;
              fxCtx.font = '700 10px "Space Grotesk", sans-serif';
              const badgeTw = fxCtx.measureText(badgeText).width;
              drawPill(
                pt.x - (badgeTw + 10) * 0.5 - 9,
                pt.y - baseR - 13,
                badgeText,
                p.highContrast ? '#facc15' : isFull ? '#fbbf24' : '#7dd3fc',
                p.highContrast ? '#000000' : 'rgba(6, 12, 24, 0.9)'
              );
            }
            fxCtx.restore();
          }

          // 0b. Radial Celebration Ripple when unlocking a collective voice
          if (p.unlockPulseNonce !== lastUnlockPulseRef.current.nonce) {
            lastUnlockPulseRef.current = { nonce: p.unlockPulseNonce, startedAtMs: nowMs };
          }
          if (
            !p.motionPaused &&
            lastUnlockPulseRef.current.startedAtMs > 0 &&
            nowMs - lastUnlockPulseRef.current.startedAtMs < 1350
          ) {
            const elapsed01 = (nowMs - lastUnlockPulseRef.current.startedAtMs) / 1350;
            const targetLon = p.selectedCountry?.lon ?? p.radiusTarget?.centerLon ?? null;
            const targetLat = p.selectedCountry?.lat ?? p.radiusTarget?.centerLat ?? null;
            if (targetLon !== null && targetLat !== null) {
              const pulsePt = projectGeo(targetLon, targetLat, 0.008);
              if (pulsePt) {
                const easeOut = 1 - Math.pow(1 - elapsed01, 3);
                const alpha = (1 - elapsed01) * 0.85;
                fxCtx.save();
                fxCtx.beginPath();
                fxCtx.arc(pulsePt.x, pulsePt.y, 16 + easeOut * 96, 0, Math.PI * 2);
                fxCtx.strokeStyle = p.highContrast
                  ? '#facc15'
                  : p.isCelebrating5of5
                    ? `rgba(251, 191, 36, ${alpha.toFixed(2)})`
                    : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
                fxCtx.lineWidth = 2.6 * (1 - elapsed01 * 0.5);
                fxCtx.stroke();

                fxCtx.beginPath();
                fxCtx.arc(pulsePt.x, pulsePt.y, 8 + easeOut * 58, 0, Math.PI * 2);
                fxCtx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.65).toFixed(2)})`;
                fxCtx.lineWidth = 1.4;
                fxCtx.stroke();
                fxCtx.restore();
              }
            }
          }

          // 1. Custom Radius Geodesic Ring
          if (p.radiusTarget) {
            const rt = p.radiusTarget;
            const latDeg = rt.radiusKm / 111.32;
            const cosLat = Math.max(0.25, Math.cos((rt.centerLat * Math.PI) / 180));
            const lonDeg = rt.radiusKm / (111.32 * cosLat);
            fxCtx.save();
            fxCtx.strokeStyle = p.highContrast ? '#facc15' : '#6488cc';
            fxCtx.lineWidth = 1.8;
            fxCtx.setLineDash([6, 4]);
            fxCtx.beginPath();
            let started = false;
            for (let s = 0; s <= 40; s++) {
              const ang = (s / 40) * Math.PI * 2;
              const pt = projectGeo(
                rt.centerLon + Math.cos(ang) * lonDeg,
                THREE.MathUtils.clamp(rt.centerLat + Math.sin(ang) * latDeg, -84, 84)
              );
              if (pt) {
                if (!started) {
                  fxCtx.moveTo(pt.x, pt.y);
                  started = true;
                } else {
                  fxCtx.lineTo(pt.x, pt.y);
                }
              } else {
                started = false;
              }
            }
            fxCtx.stroke();
            fxCtx.setLineDash([]);
            const centerPt = projectGeo(rt.centerLon, rt.centerLat);
            if (centerPt) {
              fxCtx.strokeStyle = p.highContrast ? '#ffffff' : '#6488cc';
              fxCtx.beginPath();
              fxCtx.moveTo(centerPt.x - 6, centerPt.y);
              fxCtx.lineTo(centerPt.x + 6, centerPt.y);
              fxCtx.moveTo(centerPt.x, centerPt.y - 6);
              fxCtx.lineTo(centerPt.x, centerPt.y + 6);
              fxCtx.stroke();
            }
            const topPt =
              projectGeo(
                rt.centerLon,
                THREE.MathUtils.clamp(rt.centerLat + latDeg, -84, 84)
              ) ?? centerPt;
            if (topPt) {
              drawPill(
                topPt.x - 36,
                topPt.y - 12,
                `Raio ${rt.radiusKm} km`,
                p.highContrast ? '#facc15' : '#6488cc'
              );
            }
            fxCtx.restore();
          }

          // 2. Soundscape 1:1 Telemetry Overlay
          const tel = p.soundscapeTelemetry;
          const stems = p.audibleStems;
          if (tel && stems) {
            fxCtx.save();
            fxCtx.globalAlpha = p.jukeboxPlaying ? 1.0 : 0.62;

            // Harmony / CO: amber glowing isolines + chord pill
            if (stems.harmony && tel.coSpots.length > 0) {
              const coMain = tel.coSpots[0];
              const pulse = p.jukeboxPlaying ? 0.5 + 0.5 * Math.sin(nowMs * 0.003) : 0.4;
              for (const spot of tel.coSpots.slice(0, 3)) {
                const pt = projectGeo(spot.lon, spot.lat);
                if (!pt) continue;
                fxCtx.strokeStyle = p.highContrast ? '#facc15' : 'rgba(251, 146, 60, 0.9)';
                fxCtx.lineWidth = 1.4;
                fxCtx.beginPath();
                fxCtx.ellipse(pt.x, pt.y, 18 + pulse * 6, 11 + pulse * 4, 0.25, 0, Math.PI * 2);
                fxCtx.stroke();
                fxCtx.beginPath();
                fxCtx.ellipse(pt.x, pt.y, 10 + pulse * 3, 6 + pulse * 2, 0.25, 0, Math.PI * 2);
                fxCtx.stroke();
              }
              const mainPt = projectGeo(coMain.lon, coMain.lat);
              if (mainPt) {
                drawPill(mainPt.x, mainPt.y - 16, `CO · ${tel.chordName}`, p.highContrast ? '#facc15' : '#fb923c');
              }
            }

            // Rhythm / Temp: concentric solar thermal rings pulsing to exact BPM
            if (stems.rhythm) {
              const pt = projectGeo(tel.tempHotSpot.lon, tel.tempHotSpot.lat);
              if (pt) {
                const beatFrac = p.jukeboxPlaying ? ((nowMs * tel.bpm) / 60000) % 1 : 0.25;
                for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
                  const rPhase = (beatFrac + ringIdx * 0.5) % 1;
                  const rad = 8 + rPhase * 28;
                  fxCtx.strokeStyle = p.highContrast
                    ? `rgba(250, 204, 21, ${(1 - rPhase).toFixed(2)})`
                    : `rgba(251, 113, 133, ${(1 - rPhase).toFixed(2)})`;
                  fxCtx.lineWidth = 1.8;
                  fxCtx.beginPath();
                  fxCtx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
                  fxCtx.stroke();
                }
                drawPill(pt.x, pt.y + 18, `${tel.bpm} BPM`, p.highContrast ? '#facc15' : '#fb7185');
              }
            }

            // Bass / NO2: emerald neon contour + note | cutoff Hz badge
            if (stems.bass) {
              const pt = projectGeo(tel.noxHotSpot.lon, tel.noxHotSpot.lat);
              if (pt) {
                const bassPulse = p.jukeboxPlaying ? 1 + Math.sin(nowMs * 0.008) * 0.2 : 1;
                fxCtx.strokeStyle = p.highContrast ? '#ffffff' : '#34d399';
                fxCtx.lineWidth = 1.9;
                fxCtx.beginPath();
                fxCtx.rect(pt.x - 13 * bassPulse, pt.y - 13 * bassPulse, 26 * bassPulse, 26 * bassPulse);
                fxCtx.stroke();
                drawPill(
                  pt.x,
                  pt.y,
                  `${tel.bassNoteName} | ${tel.bassCutoffHz}Hz`,
                  p.highContrast ? '#ffffff' : '#34d399'
                );
              }
            }

            // FX / Wind: dual sky-blue wind corridor streamlines + Wet %
            if (stems.fx && tel.windCorridors.length > 0) {
              fxCtx.strokeStyle = p.highContrast ? '#facc15' : '#6488cc';
              fxCtx.lineWidth = 1.5;
              for (const wc of tel.windCorridors.slice(0, 4)) {
                const p1 = projectGeo(wc.lon, wc.lat);
                const p2 = projectGeo(wc.lon + wc.dx * 3.8, wc.lat + wc.dy * 3.8);
                if (!p1 || !p2) continue;
                fxCtx.beginPath();
                fxCtx.moveTo(p1.x, p1.y);
                fxCtx.lineTo(p2.x, p2.y);
                fxCtx.stroke();
                fxCtx.beginPath();
                fxCtx.moveTo(p1.x, p1.y + 4);
                fxCtx.lineTo(p2.x, p2.y + 4);
                fxCtx.stroke();
              }
              const wPt = projectGeo(tel.windCorridors[0].lon, tel.windCorridors[0].lat);
              if (wPt) {
                drawPill(wPt.x, wPt.y - 16, `Vento · Wet ${tel.windWetPct}%`, p.highContrast ? '#facc15' : '#6488cc');
              }
            }

            // Melody / Lightning: golden crosshairs + expanding flash ring + floating note
            if (stems.melody) {
              tel.lightningMarkers.forEach((lm, idx) => {
                const pt = projectGeo(lm.lon, lm.lat);
                if (!pt) return;
                const phase = p.jukeboxPlaying ? ((nowMs + idx * 180) % 900) / 900 : 0.3;
                const col = p.highContrast ? '#facc15' : '#fbbf24';
                fxCtx.strokeStyle = col;
                fxCtx.lineWidth = 1.6;
                fxCtx.beginPath();
                fxCtx.arc(pt.x, pt.y, 7 + phase * 18, 0, Math.PI * 2);
                fxCtx.stroke();
                // Crosshair ticks
                fxCtx.beginPath();
                fxCtx.moveTo(pt.x - 10, pt.y);
                fxCtx.lineTo(pt.x - 4, pt.y);
                fxCtx.moveTo(pt.x + 4, pt.y);
                fxCtx.lineTo(pt.x + 10, pt.y);
                fxCtx.moveTo(pt.x, pt.y - 10);
                fxCtx.lineTo(pt.x, pt.y - 4);
                fxCtx.moveTo(pt.x, pt.y + 4);
                fxCtx.lineTo(pt.x, pt.y + 10);
                fxCtx.stroke();
                if (idx === 0) {
                  drawPill(pt.x, pt.y, `Raio · ${lm.noteName}`, col);
                }
              });
            }

            fxCtx.restore();
          }
        }
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('resize', onResize);

      earthGeo.dispose();
      earthMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      bordersGeo.dispose();
      bordersMat.dispose();
      highlightLine.geometry.dispose();
      highlightMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      fallbackTex.dispose();
      sceneRefs.current.maskTex?.dispose();
      sceneRefs.current.unlockTex?.dispose();
      for (const tex of sceneRefs.current.texCache.values()) {
        tex.dispose();
      }
      sceneRefs.current.texCache.clear();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, [allRings, countries]);

  return (
    <div
      ref={containerRef}
      className="earth-canvas-root"
      role="application"
      tabIndex={0}
      aria-label="Mapa interativo 3D e 2D da Terra com camadas da NASA. Use as setas do teclado para mover, mais e menos para zoom, Espaço para reproduzir ou pausar, J para Jukebox musical, E para explicação da música, V para narração por voz e R para ler os dados do local."
    >
      <canvas ref={fxOverlayRef} className="earth-fx-overlay" aria-hidden="true" />
      <div ref={labelsLayerRef} className="earth-labels-layer" aria-hidden="true" />
    </div>
  );
};
