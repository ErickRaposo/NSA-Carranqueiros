import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CountryFlagIcon } from '../components/CountryFlag';
import { Mineiro3D } from '../components/Mineiro3D';
import { resolveCountryAssetUrl } from '../datasets/nasaDatasets';
import { useExperience } from '../experience/ExperienceContext';
import {
  LAYER_METAS,
  SceneSurfaceProps,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../experience/types';
import {
  COUNTRY_ID_TO_ALPHA2,
  midiToNoteName,
  projectBboxNormToCountryPng01,
} from './studioGeometry';

interface JukeboxStudioStageProps {
  renderContext: SceneSurfaceProps['renderContext'] | 'controller';
  storyStep?: number;
  robotText?: string;
  hideRobot?: boolean;
}

interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasLayoutMetrics {
  tileBoxes: Record<VisualLayerId, HitBox>;
  pianoBox: HitBox;
}

const TILE_SHORT_LABELS: Record<VisualLayerId, { pt: string; en: string }> = {
  melody: { pt: '1. Raios ISS (SVS 5011) · Melodia', en: '1. ISS Lightning (SVS 5011) · Melody' },
  chords: { pt: '2. CO (SVS 5153) · Acordes', en: '2. CO (SVS 5153) · Chords' },
  bass: { pt: '3. NO₂ (SVS 5154) · Baixo', en: '3. NO₂ (SVS 5154) · Bass' },
  wind: { pt: '4. Vento 8D (SVS 5148) · Efeitos', en: '4. 8D Wind (SVS 5148) · FX' },
  temperature: { pt: '5. Temp (SVS 5147) · Regência', en: '5. Temp (SVS 5147) · Conductor' },
};

const PITCH_REFS: ReadonlyArray<{ midi: number; label: string }> = [
  { midi: 36, label: 'C2' },
  { midi: 48, label: 'C3' },
  { midi: 60, label: 'C4' },
  { midi: 72, label: 'C5' },
  { midi: 84, label: 'C6' },
];

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number
): void {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4 - Math.PI / 2;
    const rad = k % 2 === 0 ? rOuter : rInner;
    const sx = cx + Math.cos(ang) * rad;
    const sy = cy + Math.sin(ang) * rad;
    if (k === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

function drawCanvasPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  text: string,
  fontPx: number,
  fillStyle: string,
  strokeStyle: string,
  textColor: string,
  padX: number,
  maxWidth?: number
): number {
  ctx.font = `600 ${fontPx.toFixed(2)}px 'Poppins', system-ui, sans-serif`;
  const rawTw = ctx.measureText(text).width;
  const innerW = maxWidth ? Math.min(rawTw, Math.max(10, maxWidth - padX * 2)) : rawTw;
  const pillW = innerW + padX * 2;
  drawRoundedRectPath(ctx, x, y, pillW, h, h * 0.5);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = Math.max(0.6, fontPx * 0.1);
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h * 0.53, innerW);
  return pillW;
}

export const JukeboxStudioStage: React.FC<JukeboxStudioStageProps> = ({
  renderContext,
  storyStep = 1,
  robotText = '',
  hideRobot = false,
}) => {
  const {
    country,
    lang,
    layers,
    playback,
    pngUrls,
    studioData,
    activeStudioSession,
    barLoop,
    speechStatus,
    getLiveFrame,
    toggleEye,
    seekProgress,
  } = useExperience();

  const isPt = lang === 'pt';
  const interactive = renderContext === 'controller';
  const showTopHeader = renderContext !== 'controller';

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Wall local layout dimensions (`clientWidth` / `clientHeight`), immune to CSS 3D rotation & matrix3d
  const [wallSize, setWallSize] = useState<{ w: number; h: number }>({ w: 900, h: 675 });
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 900, h: 675, dpr: 1 });
  const layoutRef = useRef<CanvasLayoutMetrics | null>(null);
  const scrubbingRollRef = useRef<boolean>(false);

  // Preload 5 country silhouette PNGs (fallback) + 5 96-frame NASA SVS video sprite sheets (12x8)
  const imagesRef = useRef<Partial<Record<VisualLayerId, HTMLImageElement>>>({});
  const videoSheetsRef = useRef<Partial<Record<VisualLayerId, HTMLImageElement>>>({});
  useEffect(() => {
    if (!pngUrls || typeof Image === 'undefined') {
      imagesRef.current = {};
      return;
    }
    const nextMap: Partial<Record<VisualLayerId, HTMLImageElement>> = {};
    for (const lid of VISUAL_LAYER_ORDER) {
      const img = new Image();
      if (/^https?:\/\//i.test(pngUrls[lid])) {
        img.crossOrigin = 'anonymous';
      }
      img.decoding = 'async';
      img.src = pngUrls[lid];
      nextMap[lid] = img;
    }
    imagesRef.current = nextMap;
  }, [pngUrls]);

  useEffect(() => {
    if (!country?.id || typeof Image === 'undefined') {
      videoSheetsRef.current = {};
      return;
    }
    const nextSheets: Partial<Record<VisualLayerId, HTMLImageElement>> = {};
    for (const lid of VISUAL_LAYER_ORDER) {
      const sheetImg = new Image();
      const sheetUrl = resolveCountryAssetUrl(country.id, `video/${lid}_sheet.jpg`);
      if (/^https?:\/\//i.test(sheetUrl)) {
        sheetImg.crossOrigin = 'anonymous';
      }
      sheetImg.decoding = 'async';
      sheetImg.src = sheetUrl;
      nextSheets[lid] = sheetImg;
    }
    videoSheetsRef.current = nextSheets;
  }, [country?.id]);

  // Latest state refs for the 60fps rAF loop
  const stateRef = useRef({
    country,
    isPt,
    layers,
    playback,
    studioData,
    activeStudioSession,
    barLoop,
    getLiveFrame,
    hideRobot,
    showTopHeader,
  });
  stateRef.current = {
    country,
    isPt,
    layers,
    playback,
    studioData,
    activeStudioSession,
    barLoop,
    getLiveFrame,
    hideRobot,
    showTopHeader,
  };

  useEffect(() => {
    const rootEl = rootRef.current;
    const canvas = canvasRef.current;
    if (!rootEl || !canvas) return;

    const syncSize = () => {
      const cw = Math.max(120, rootEl.clientWidth || 900);
      const ch = Math.max(90, rootEl.clientHeight || 675);
      setWallSize((prev) => (prev.w === cw && prev.h === ch ? prev : { w: cw, h: ch }));

      const baseDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      // Supersample small 3D Simulator walls so text, stars and MIDI notes stay crisp under 3D perspective
      const boost = cw < 520 ? 2.25 : 1;
      const dpr = Math.min(3.5, baseDpr * boost);

      sizeRef.current = { w: cw, h: ch, dpr };
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    syncSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncSize);
      ro.observe(rootEl);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, []);

  // Main 60fps Full-Wall Studio Canvas Renderer (Top Bar + 5 NASA Layer Tiles + Looping MIDI Piano-Roll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let raf = 0;

    const renderFrame = (nowMs: number) => {
      const { w: W, h: H, dpr } = sizeRef.current;
      const {
        country: curCountry,
        isPt: pt,
        layers: lyr,
        playback: pb,
        studioData: sData,
        activeStudioSession: session,
        barLoop: loopRange,
        getLiveFrame: readFrame,
        hideRobot: noRobot,
        showTopHeader: hasTopHeader,
      } = stateRef.current;

      const live = readFrame();
      const prog01 = live.progress01;
      const totalBars = session?.totalBars || pb.totalBars || 8;
      const totalBeats = totalBars * 4;
      const curBeat = prog01 * totalBeats;
      const curBar = Math.min(totalBars - 1, Math.floor(curBeat / 4));
      const numFrames = sData?.numFrames || 96;
      const fIdx = Math.min(numFrames - 1, Math.max(0, Math.floor(prog01 * numFrames)));

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Pure #000000 projection void background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // Strictly proportional unit `u` across 100% of the wall (zero DOM font-size inflation!)
      const u = Math.min(W / 900, H / 560);
      const pad = 10 * u;
      const gap = 8 * u;

      // =======================================================================
      // 0. TOP STUDIO HEADER BAR (0 .. topBarH, omitted when embedded in Tablet)
      // =======================================================================
      const topBarH = hasTopHeader ? 40 * u : 0;
      const keyLbl = pt ? pb.keyRootPt : pb.keyRoot;
      const tempRegionOn = lyr.temperature.enabled && lyr.temperature.tuningMode === 'region';

      if (hasTopHeader) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = Math.max(0.6, 1 * u);
        ctx.beginPath();
        ctx.moveTo(0, topBarH);
        ctx.lineTo(W, topBarH);
        ctx.stroke();

        const countryTitle = curCountry
          ? pt
            ? curCountry.namePt
            : curCountry.nameEn
          : pt
            ? 'Terra'
            : 'Earth';
        const modeLbl = pt ? pb.modeNamePt : pb.modeNameEn;

        // Reserve space on left for flag overlay (24*u) and on right for Mineiro3D overlay (285*u when visible)
        const flagReserveW = curCountry ? 25 * u : 0;
        const rightOverlayW = noRobot ? 0 : 285 * u;
        let hx = pad + flagReserveW;
        const hyMid = topBarH * 0.52;

        ctx.font = `700 ${(14.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
        ctx.fillStyle = '#f8fafc';
        ctx.textBaseline = 'middle';
        const maxTitleW = 140 * u;
        ctx.fillText(countryTitle, hx, hyMid, maxTitleW);
        hx += Math.min(maxTitleW, ctx.measureText(countryTitle).width) + 8 * u;

        const pillH = 21 * u;
        const pillY = (topBarH - pillH) * 0.5;
        const climateTxt = `${tempRegionOn ? (pt ? 'CLIMA REAL' : 'REAL CLIMATE') : 'BASE 90'} · ${keyLbl} · ${pb.bpm} BPM · ${pb.durationSeconds.toFixed(1)}s`;
        hx +=
          drawCanvasPill(
            ctx,
            hx,
            pillY,
            pillH,
            climateTxt,
            9.6 * u,
            tempRegionOn ? 'rgba(251, 113, 133, 0.14)' : 'rgba(15, 23, 42, 0.8)',
            tempRegionOn ? 'rgba(251, 113, 133, 0.45)' : 'rgba(148, 163, 184, 0.28)',
            tempRegionOn ? '#fecdd3' : '#cbd5e1',
            7.5 * u
          ) +
          6 * u;

        const remainingBeforeRobot = W - rightOverlayW - hx;
        if (remainingBeforeRobot > 65 * u) {
          const chordTxt = `${modeLbl} · C${curBar + 1}: ${pb.activeChord}`;
          hx +=
            drawCanvasPill(
              ctx,
              hx,
              pillY,
              pillH,
              chordTxt,
              9.4 * u,
              'rgba(251, 191, 36, 0.10)',
              'rgba(251, 191, 36, 0.32)',
              '#fde68a',
              7 * u,
              remainingBeforeRobot - (loopRange ? 76 * u : 4 * u)
            ) +
            6 * u;
        }

        if (loopRange && W - rightOverlayW - hx > 52 * u) {
          drawCanvasPill(
            ctx,
            hx,
            pillY,
            pillH,
            `LOOP C${loopRange[0] + 1}–C${loopRange[1] + 1}`,
            9.0 * u,
            'rgba(56, 189, 248, 0.16)',
            'rgba(56, 189, 248, 0.5)',
            '#bae6fd',
            6.5 * u
          );
        }
      }

      // =======================================================================
      // 1. MIDDLE ROW: 5 NASA LAYER MAP TILES (~36% of wall height)
      // =======================================================================
      const tilesY = topBarH + gap;
      const tileW = (W - pad * 2 - gap * 4) / 5;
      const hdrH = 22 * u;
      const availBelowHeader = H - tilesY - pad;
      const tilesH = Math.min(availBelowHeader * 0.41, tileW + hdrH + 4 * u);

      const spkSolo = lyr.melody.sparkleSolo;
      const anySolo = spkSolo || lyr.melody.solo || lyr.chords.solo || lyr.bass.solo;
      const melMainAudible = !spkSolo && lyr.melody.enabled && (!anySolo || lyr.melody.solo);
      const spkAudible = spkSolo
        ? lyr.melody.sparkleEnabled
        : lyr.melody.enabled && lyr.melody.sparkleEnabled && (!anySolo || lyr.melody.solo);
      const chdAudible = !spkSolo && lyr.chords.enabled && (!anySolo || lyr.chords.solo);
      const basAudible = !spkSolo && lyr.bass.enabled && (!anySolo || lyr.bass.solo);
      const wndEnabled = lyr.wind.enabled && lyr.wind.wetMix > 0.005;

      const tileBoxes = {} as Record<VisualLayerId, HitBox>;

      VISUAL_LAYER_ORDER.forEach((lid, idx) => {
        const meta = LAYER_METAS[lid];
        const tx = pad + idx * (tileW + gap);
        const ty = tilesY;
        const mapY = ty + hdrH;
        const mapH = Math.max(10, tilesH - hdrH);

        tileBoxes[lid] = { x: tx, y: ty, w: tileW, h: tilesH };

        const isLayerSolo =
          (lid === 'melody' && (lyr.melody.solo || spkSolo)) ||
          (lid === 'chords' && lyr.chords.solo) ||
          (lid === 'bass' && lyr.bass.solo);

        const tileAudible =
          lid === 'melody'
            ? melMainAudible || spkAudible
            : lid === 'chords'
              ? chdAudible
              : lid === 'bass'
                ? basAudible
                : lid === 'wind'
                  ? wndEnabled
                  : tempRegionOn;

        const radius = 8 * u;

        drawRoundedRectPath(ctx, tx, ty, tileW, tilesH, radius);
        ctx.fillStyle = '#050914';
        ctx.fill();
        ctx.lineWidth = Math.max(0.7, (isLayerSolo ? 1.8 : 1.0) * u);
        ctx.strokeStyle = isLayerSolo
          ? meta.accentHex
          : tileAudible
            ? 'rgba(148, 163, 184, 0.25)'
            : 'rgba(148, 163, 184, 0.12)';
        ctx.stroke();

        ctx.save();
        drawRoundedRectPath(ctx, tx, ty, tileW, tilesH, radius);
        ctx.clip();

        ctx.fillStyle = '#080f20';
        ctx.fillRect(tx, ty, tileW, hdrH);
        ctx.fillStyle = tileAudible ? meta.accentHex : '#334155';
        ctx.fillRect(tx, ty, tileW, Math.max(1.2, 2.8 * u));

        const eyeGlyph = lyr[lid].enabled ? '◉' : '◌';
        const shortLabel = pt ? TILE_SHORT_LABELS[lid].pt : TILE_SHORT_LABELS[lid].en;
        ctx.font = `600 ${(10.0 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
        ctx.fillStyle = tileAudible ? '#f8fafc' : '#64748b';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${eyeGlyph} ${shortLabel}`,
          tx + 6 * u,
          ty + hdrH * 0.54,
          Math.max(10, tileW - 30 * u)
        );

        const vuLevel =
          lid === 'melody'
            ? Math.max(live.vu.melody, live.vu.sparkle)
            : lid === 'temperature'
              ? tempRegionOn
                ? 0.75
                : 0.15
              : live.vu[lid];
        const vuW = 19 * u;
        const vuH = 4 * u;
        const vuX = tx + tileW - vuW - 5 * u;
        const vuY = ty + (hdrH - vuH) * 0.5;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
        ctx.fillRect(vuX, vuY, vuW, vuH);
        if (vuLevel > 0.01 && tileAudible) {
          ctx.fillStyle = meta.accentHex;
          ctx.fillRect(vuX, vuY, vuW * Math.min(1, vuLevel), vuH);
        }

        const sqSize = Math.max(8, Math.min(tileW - 6 * u, mapH - 4 * u));
        const sqX = tx + (tileW - sqSize) * 0.5;
        const sqY = mapY + (mapH - sqSize) * 0.5;

        if (tileAudible) {
          const grad = ctx.createRadialGradient(
            sqX + sqSize * 0.5,
            sqY + sqSize * 0.5,
            sqSize * 0.06,
            sqX + sqSize * 0.5,
            sqY + sqSize * 0.5,
            sqSize * 0.52
          );
          grad.addColorStop(0, `${meta.accentHex}22`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(tx, mapY, tileW, mapH);
        }

        const sheetImg = videoSheetsRef.current[lid];
        const staticImg = imagesRef.current[lid];
        const layerAlpha = tileAudible
          ? lid === 'wind'
            ? 0.52 + Math.min(1, lyr.wind.wetMix) * 0.48
            : Math.min(1, 0.58 + lyr[lid].gain * 0.42)
          : 0.18;

        if (sheetImg && sheetImg.complete && sheetImg.naturalWidth > 0) {
          const cols = 12;
          const rows = 8;
          const fw = sheetImg.naturalWidth / cols;
          const fh = sheetImg.naturalHeight / rows;
          const col = fIdx % cols;
          const row = Math.floor(fIdx / cols) % rows;
          ctx.save();
          ctx.globalAlpha = layerAlpha;
          ctx.drawImage(sheetImg, col * fw, row * fh, fw, fh, sqX, sqY, sqSize, sqSize);
          ctx.restore();
        } else if (staticImg && staticImg.complete && staticImg.naturalWidth > 0) {
          ctx.save();
          ctx.globalAlpha = layerAlpha;
          ctx.drawImage(staticImg, sqX, sqY, sqSize, sqSize);
          ctx.restore();
        }

        if (!tileAudible) {
          ctx.fillStyle = 'rgba(2, 5, 12, 0.72)';
          ctx.fillRect(tx, mapY, tileW, mapH);
          ctx.fillStyle = '#94a3b8';
          ctx.font = `600 ${(9.0 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          const offTxt =
            lid === 'temperature'
              ? pt
                ? 'BASE NEUTRA (90 BPM)'
                : 'NEUTRAL BASE (90 BPM)'
              : pt
                ? 'OLHINHO DESLIGADO'
                : 'LAYER MUTED';
          const tw = ctx.measureText(offTxt).width;
          ctx.fillText(offTxt, tx + (tileW - tw) * 0.5, mapY + mapH * 0.5);
        }

        const bbox = curCountry?.bbox ?? null;

        if (lid === 'melody') {
          if (sData?.persistentPeaks && melMainAudible) {
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.44)';
            ctx.lineWidth = Math.max(0.6, 1.2 * u);
            for (const [ax, ay] of sData.persistentPeaks) {
              const uv = projectBboxNormToCountryPng01(ax, ay, bbox);
              ctx.beginPath();
              ctx.arc(sqX + uv.x01 * sqSize, sqY + uv.y01 * sqSize, 4.4 * u, 0, Math.PI * 2);
              ctx.stroke();
            }
          }

          if (session && melMainAudible) {
            for (const n of session.tracks.melody) {
              const dt = curBeat - n.start_beat;
              const win = Math.min(n.duration_beats, 0.65);
              if (dt >= 0 && dt <= win) {
                const age01 = dt / Math.max(0.08, win);
                const uv = projectBboxNormToCountryPng01(n.source_x, n.source_y, bbox);
                const px = sqX + uv.x01 * sqSize;
                const py = sqY + uv.y01 * sqSize;
                const ringR = (4 + age01 * 11) * u;

                ctx.strokeStyle = n.is_anchor
                  ? `rgba(253, 224, 71, ${(1 - age01 * 0.65).toFixed(2)})`
                  : `rgba(255, 255, 255, ${(1 - age01 * 0.7).toFixed(2)})`;
                ctx.lineWidth = Math.max(0.8, (n.is_anchor ? 2.2 : 1.6) * u);
                ctx.beginPath();
                ctx.arc(px, py, ringR, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(px, py, 2.8 * u, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = `700 ${(9.2 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
                ctx.fillStyle = '#fef08a';
                ctx.fillText(midiToNoteName(n.pitch), px + 5 * u, py - 4 * u);
              }
            }
          }

          if (session && spkAudible) {
            for (const sp of session.tracks.melody_sparkle) {
              const isCrystal = sp.sub_role === 'crystal_sparkle';
              const win = isCrystal ? 0.3 : Math.min(sp.duration_beats, 0.55);
              const dt = curBeat - sp.start_beat;
              if (dt >= 0 && dt <= win) {
                const uv = projectBboxNormToCountryPng01(sp.source_x, sp.source_y, bbox);
                const sx = sqX + uv.x01 * sqSize;
                const sy = sqY + uv.y01 * sqSize;

                if (isCrystal) {
                  drawFourPointStar(ctx, sx, sy, 7.5 * u, 2.6 * u);
                  ctx.fillStyle = '#67f3ff';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = Math.max(0.5, 1.0 * u);
                  ctx.stroke();
                } else {
                  ctx.strokeStyle = 'rgba(103, 243, 255, 0.85)';
                  ctx.lineWidth = Math.max(0.7, 1.5 * u);
                  ctx.beginPath();
                  ctx.arc(sx, sy, 6.2 * u, 0, Math.PI * 2);
                  ctx.stroke();
                }
              }
            }
          }

          const yCnt = sData?.yellowCounts?.[fIdx] ?? live.lightningCount ?? 0;
          let badgeTxt = pt ? `TIMBRE PURO (${yCnt})` : `PURE TIMBRE (${yCnt})`;
          let badgeCol = '#cbd5e1';
          if (!lyr.melody.sparkleEnabled && !spkSolo) {
            badgeTxt = pt ? `5ª/8ª OFF (${yCnt})` : `STORM OFF (${yCnt})`;
            badgeCol = '#94a3b8';
          } else if (yCnt >= 49) {
            badgeTxt = pt ? `TEMPESTADE: ${yCnt} PTS ✦` : `STORM: ${yCnt} PTS ✦`;
            badgeCol = '#67f3ff';
          } else if (yCnt >= 13) {
            badgeTxt = pt ? `PESO 5ª/8ª (${yCnt})` : `5TH/8VE (${yCnt})`;
            badgeCol = '#fbbf24';
          }
          const bh = 14.5 * u;
          ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
          ctx.fillRect(tx + 4 * u, ty + tilesH - bh - 3 * u, tileW - 8 * u, bh);
          ctx.fillStyle = badgeCol;
          ctx.font = `700 ${(8.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          ctx.fillText(badgeTxt, tx + 7 * u, ty + tilesH - bh * 0.5 - 3 * u, tileW - 14 * u);
        }

        if (lid === 'chords' && chdAudible) {
          const chordName = session?.chordProgression?.[curBar] ?? pb.activeChord;
          if (session) {
            const activeChd = session.tracks.chords_pad.find(
              (c) => curBeat >= c.start_beat && curBeat <= c.start_beat + c.duration_beats
            );
            if (activeChd) {
              const uv = projectBboxNormToCountryPng01(activeChd.source_x, activeChd.source_y, bbox);
              const cx = sqX + uv.x01 * sqSize;
              const cy = sqY + uv.y01 * sqSize;
              const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.006);
              ctx.strokeStyle = 'rgba(251, 146, 60, 0.72)';
              ctx.lineWidth = Math.max(0.7, 1.5 * u);
              ctx.beginPath();
              ctx.arc(cx, cy, (5 + pulse * 4) * u, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          const bh = 14.5 * u;
          ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
          ctx.fillRect(tx + 4 * u, ty + tilesH - bh - 3 * u, Math.min(tileW - 8 * u, 96 * u), bh);
          ctx.fillStyle = '#fb923c';
          ctx.font = `700 ${(8.8 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          ctx.fillText(`C${curBar + 1}: ${chordName}`, tx + 7 * u, ty + tilesH - bh * 0.5 - 3 * u);
        }

        if (lid === 'temperature') {
          const bh = 14.5 * u;
          ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
          ctx.fillRect(tx + 4 * u, ty + tilesH - bh - 3 * u, tileW - 8 * u, bh);
          ctx.fillStyle = tempRegionOn ? '#fb7185' : '#94a3b8';
          ctx.font = `700 ${(8.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          const tBadge = tempRegionOn
            ? `REGION: ${keyLbl} • ${pb.bpm} BPM`
            : pt
              ? 'BASE: Lá • 90 BPM'
              : 'BASE: A • 90 BPM';
          ctx.fillText(tBadge, tx + 7 * u, ty + tilesH - bh * 0.5 - 3 * u, tileW - 14 * u);
        }

        if (lid === 'bass' && basAudible) {
          const barPhase01 = (curBeat % 4) / 4;
          const scanUv = projectBboxNormToCountryPng01(barPhase01, 0.5, bbox);
          const scanX = sqX + scanUv.x01 * sqSize;
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
          ctx.lineWidth = Math.max(0.7, 1.5 * u);
          ctx.beginPath();
          ctx.moveTo(scanX, mapY + 2 * u);
          ctx.lineTo(scanX, ty + tilesH - 2 * u);
          ctx.stroke();

          if (session) {
            const activeBas = session.tracks.bass.find(
              (b) => curBeat >= b.start_beat && curBeat <= b.start_beat + b.duration_beats
            );
            if (activeBas) {
              const uv = projectBboxNormToCountryPng01(activeBas.source_x, activeBas.source_y, bbox);
              const bx = sqX + uv.x01 * sqSize;
              const by = sqY + uv.y01 * sqSize;
              ctx.fillStyle = '#34d399';
              ctx.beginPath();
              ctx.arc(bx, by, 3.6 * u, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          const cutoff = session?.musicalParameters.bass.cutoffHz ?? 180;
          const bh = 14.5 * u;
          ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
          ctx.fillRect(tx + 4 * u, ty + tilesH - bh - 3 * u, Math.min(tileW - 8 * u, 92 * u), bh);
          ctx.fillStyle = '#34d399';
          ctx.font = `700 ${(8.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          ctx.fillText(`NO₂ ${cutoff} Hz`, tx + 7 * u, ty + tilesH - bh * 0.5 - 3 * u);
        }

        if (lid === 'wind') {
          const wp = sData?.windProfile;
          let windPanX = 0;
          let windHx = 0.5;
          let windHy = 0.5;
          if (wp && wp.orientation.length > 0) {
            const nSlots = wp.orientation.length;
            const pos = Math.max(0, Math.min(nSlots - 1, prog01 * nSlots));
            const i0 = Math.floor(pos) % nSlots;
            const i1 = (i0 + 1) % nSlots;
            const frac = pos - Math.floor(pos);
            const lerp = (arr: number[], fb: number) =>
              arr.length > 0 ? (arr[i0] ?? fb) + ((arr[i1] ?? arr[i0] ?? fb) - (arr[i0] ?? fb)) * frac : fb;
            const orient = lerp(wp.orientation, 0);
            windHx = lerp(wp.hotspotX, 0.5);
            windHy = lerp(wp.hotspotY, 0.5);
            windPanX = Math.max(-1, Math.min(1, orient * 0.65 + (windHx - 0.5) * 2 * 0.55));
          }

          if (wndEnabled) {
            const uv = projectBboxNormToCountryPng01(windHx, windHy, bbox);
            const wx = sqX + uv.x01 * sqSize;
            const wy = sqY + uv.y01 * sqSize;
            const arrowLen = Math.max(8 * u, Math.abs(windPanX) * sqSize * 0.34);
            const dirSign = windPanX >= 0 ? 1 : -1;
            const axEnd = Math.max(sqX + 6 * u, Math.min(sqX + sqSize - 6 * u, wx + dirSign * arrowLen));

            // Actual directional wind vector (West <-> East)
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.lineWidth = Math.max(1.0, 2.0 * u);
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(axEnd, wy);
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(wx, wy, 4.0 * u, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.6, 1.0 * u);
            ctx.stroke();
          }

          const dirLabel =
            windPanX < -0.14
              ? pt
                ? 'OESTE ◀'
                : 'WEST ◀'
              : windPanX > 0.14
                ? pt
                  ? '▶ LESTE'
                  : '▶ EAST'
                : pt
                  ? 'CENTRO'
                  : 'CENTER';
          const bh = 14.5 * u;
          ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
          ctx.fillRect(tx + 4 * u, ty + tilesH - bh - 3 * u, Math.min(tileW - 8 * u, 124 * u), bh);
          ctx.fillStyle = wndEnabled ? '#38bdf8' : '#64748b';
          ctx.font = `700 ${(8.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          const wTxt = wndEnabled ? `8D ${dirLabel} · ${Math.round(lyr.wind.wetMix * 100)}%` : '8D DRY (OFF)';
          ctx.fillText(wTxt, tx + 7 * u, ty + tilesH - bh * 0.5 - 3 * u, Math.min(tileW - 14 * u, 118 * u));
        }

        ctx.restore();
      });

      // =======================================================================
      // 2. BOTTOM MAIN AREA: 60FPS LOOPING MIDI PIANO-ROLL (8 BARS C1..C8)
      // =======================================================================
      const rollBoxX = pad;
      const rollBoxY = tilesY + tilesH + gap;
      const rollBoxW = W - pad * 2;
      const rollBoxH = Math.max(30 * u, H - rollBoxY - pad);

      drawRoundedRectPath(ctx, rollBoxX, rollBoxY, rollBoxW, rollBoxH, 10 * u);
      ctx.fillStyle = '#040711';
      ctx.fill();
      ctx.lineWidth = Math.max(0.7, 1.0 * u);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.stroke();

      const legendH = 22 * u;
      const barHdrH = 16 * u;
      const padL = 35 * u;
      const padR = 12 * u;
      const padB = 8 * u;

      const px0 = rollBoxX + padL;
      const py0 = rollBoxY + legendH + barHdrH;
      const pw = Math.max(20, rollBoxW - padL - padR);
      const ph = Math.max(16, rollBoxH - legendH - barHdrH - padB);

      layoutRef.current = {
        tileBoxes,
        pianoBox: { x: px0, y: rollBoxY + legendH, w: pw, h: ph + barHdrH },
      };

      ctx.textBaseline = 'middle';
      ctx.font = `700 ${(10.2 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
      ctx.fillStyle = '#e2e8f0';
      const rollTitle = pt
        ? `PARTITURA MIDI EM LOOP (${totalBars} COMPASSOS)`
        : `LOOPING MIDI SCORE (${totalBars} BARS)`;
      ctx.fillText(rollTitle, rollBoxX + 10 * u, rollBoxY + legendH * 0.55);

      const legendItems = pt
        ? [
            { label: 'Melodia + Âncoras', color: '#fbbf24' },
            { label: '5ª/8ª + Cintilação', color: '#67f3ff' },
            { label: 'Acordes CO', color: '#fb923c' },
            { label: 'Baixo NO₂', color: '#34d399' },
          ]
        : [
            { label: 'Melody + Anchors', color: '#fbbf24' },
            { label: '5th/8ve + Sparkle', color: '#67f3ff' },
            { label: 'CO Chords', color: '#fb923c' },
            { label: 'NO₂ Bass', color: '#34d399' },
          ];
      ctx.font = `600 ${(9.0 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
      let cursorRight = rollBoxX + rollBoxW - 10 * u;
      for (let i = legendItems.length - 1; i >= 0; i--) {
        const item = legendItems[i];
        const tw = ctx.measureText(item.label).width;
        const itemW = tw + 13 * u;
        if (cursorRight - itemW < rollBoxX + 250 * u) break;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(item.label, cursorRight - tw, rollBoxY + legendH * 0.55);
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(cursorRight - tw - 6 * u, rollBoxY + legendH * 0.55, 3.2 * u, 0, Math.PI * 2);
        ctx.fill();
        cursorRight -= itemW + 9 * u;
      }

      ctx.fillStyle = '#02050c';
      ctx.fillRect(px0, py0, pw, ph);

      const chordsArr = session?.chordProgression ?? [];
      for (let b = 0; b <= totalBars; b++) {
        const bx = px0 + (b / totalBars) * pw;
        ctx.strokeStyle = b % 2 === 0 ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = Math.max(0.6, (b === 0 || b === totalBars ? 1.2 : 0.9) * u);
        ctx.beginPath();
        ctx.moveTo(bx, py0 - barHdrH);
        ctx.lineTo(bx, py0 + ph);
        ctx.stroke();

        if (b < totalBars) {
          const bw = pw / totalBars;
          const isCurBar = b === curBar;
          if (isCurBar) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
            ctx.fillRect(bx, py0 - barHdrH, bw, barHdrH + ph);
          }

          ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
          ctx.lineWidth = Math.max(0.5, 0.8 * u);
          for (let q = 1; q < 4; q++) {
            const qx = bx + (q / 4) * bw;
            ctx.beginPath();
            ctx.moveTo(qx, py0);
            ctx.lineTo(qx, py0 + ph);
            ctx.stroke();
          }

          const cSym = chordsArr[b] ?? '';
          const hdrTxt = cSym ? `C${b + 1} · ${cSym}` : `C${b + 1}`;
          ctx.font = `600 ${(9.0 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
          ctx.fillStyle = isCurBar ? '#f8fafc' : '#94a3b8';
          ctx.fillText(hdrTxt, bx + 4 * u, py0 - barHdrH * 0.48, bw - 6 * u);
        }
      }

      if (loopRange) {
        const [lb0, lb1] = loopRange;
        const lx0 = px0 + (lb0 / totalBars) * pw;
        const lx1 = px0 + ((lb1 + 1) / totalBars) * pw;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
        if (lx0 > px0) ctx.fillRect(px0, py0, lx0 - px0, ph);
        if (lx1 < px0 + pw) ctx.fillRect(lx1, py0, px0 + pw - lx1, ph);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.fillRect(lx0, py0, lx1 - lx0, ph);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.0, 1.8 * u);
        ctx.beginPath();
        ctx.moveTo(lx0, py0 - barHdrH);
        ctx.lineTo(lx0, py0 + ph);
        ctx.moveTo(lx1, py0 - barHdrH);
        ctx.lineTo(lx1, py0 + ph);
        ctx.stroke();
      }

      const midiLo = 34;
      const midiHi = 95;
      const yForPitch = (midi: number): number => {
        const norm = (midi - midiLo) / (midiHi - midiLo);
        const clamped = Math.max(0.02, Math.min(0.98, norm));
        return py0 + ph - clamped * ph;
      };

      ctx.font = `600 ${(8.8 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
      for (const ref of PITCH_REFS) {
        const ry = yForPitch(ref.midi);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
        ctx.lineWidth = Math.max(0.5, 0.9 * u);
        ctx.beginPath();
        ctx.moveTo(px0, ry);
        ctx.lineTo(px0 + pw, ry);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.fillText(ref.label, rollBoxX + 7 * u, ry);
      }

      // =======================================================================
      // 3. DRAW MIDI SCORE TRACKS
      // =======================================================================
      if (session) {
        const chdGain = lyr.chords.gain;
        const basGain = lyr.bass.gain;
        const melGain = lyr.melody.gain;
        const spkGain = lyr.melody.gain * lyr.melody.sparkleGain;

        const chdAlpha = !chdAudible ? 0.11 : Math.min(0.9, 0.36 + 0.44 * Math.min(1.3, chdGain));
        const chdH = 5.0 * u;
        for (const c of session.tracks.chords_pad) {
          const nx = px0 + (c.start_beat / totalBeats) * pw;
          const nw = Math.max(1.5 * u, (c.duration_beats / totalBeats) * pw - 0.8 * u);
          const ny = yForPitch(c.pitch) - chdH * 0.5;
          const active = chdAudible && curBeat >= c.start_beat && curBeat <= c.start_beat + c.duration_beats;

          ctx.globalAlpha = active ? Math.min(1, chdAlpha + 0.22) : chdAlpha;
          ctx.fillStyle = '#fb923c';
          ctx.fillRect(nx, ny, nw, chdH);
          if (active) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#fed7aa';
            ctx.lineWidth = Math.max(0.6, 1.0 * u);
            ctx.strokeRect(nx, ny, nw, chdH);
          }
        }

        const basAlpha = !basAudible ? 0.11 : Math.min(1, 0.46 + 0.5 * Math.min(1.3, basGain));
        const basH = 6.8 * u;
        for (const b of session.tracks.bass) {
          const nx = px0 + (b.start_beat / totalBeats) * pw;
          const nw = Math.max(2 * u, (b.duration_beats / totalBeats) * pw - 0.8 * u);
          const ny = yForPitch(b.pitch) - basH * 0.5;
          const active = basAudible && curBeat >= b.start_beat && curBeat <= b.start_beat + b.duration_beats;

          ctx.globalAlpha = active ? 1 : basAlpha;
          ctx.fillStyle = '#34d399';
          ctx.fillRect(nx, ny, nw, basH);
          if (active) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.7, 1.3 * u);
            ctx.strokeRect(nx, ny, nw, basH);
          }
        }

        const spkAlpha = !spkAudible ? 0.1 : Math.min(1, 0.42 + 0.55 * Math.min(1.4, spkGain));
        const bloomH = 4.6 * u;
        for (const sp of session.tracks.melody_sparkle) {
          const isCrystal = sp.sub_role === 'crystal_sparkle';
          const nx = px0 + (sp.start_beat / totalBeats) * pw;
          const nyCenter = yForPitch(sp.pitch);
          const win = isCrystal ? 0.3 : sp.duration_beats;
          const active = spkAudible && curBeat >= sp.start_beat && curBeat <= sp.start_beat + win;

          ctx.globalAlpha = active ? 1 : spkAlpha;
          if (isCrystal) {
            const starR = (active ? 6.0 : 4.2) * u;
            drawFourPointStar(ctx, nx + starR * 0.4, nyCenter, starR, starR * 0.36);
            ctx.fillStyle = active ? '#ffffff' : '#67f3ff';
            ctx.fill();
          } else {
            const nw = Math.max(2 * u, (sp.duration_beats / totalBeats) * pw - 0.8 * u);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(nx, nyCenter - bloomH * 0.5, nw, bloomH);
            if (active) {
              ctx.strokeStyle = '#e0f2fe';
              ctx.lineWidth = Math.max(0.6, 1.0 * u);
              ctx.strokeRect(nx, nyCenter - bloomH * 0.5, nw, bloomH);
            }
          }
        }

        const melAlpha = !melMainAudible ? 0.11 : Math.min(1, 0.5 + 0.5 * Math.min(1.3, melGain));
        for (const n of session.tracks.melody) {
          const isAnchor = Boolean(n.is_anchor);
          const melH = (isAnchor ? 8.2 : 6.4) * u;
          const nx = px0 + (n.start_beat / totalBeats) * pw;
          const nw = Math.max(3 * u, (n.duration_beats / totalBeats) * pw - 0.8 * u);
          const ny = yForPitch(n.pitch) - melH * 0.5;
          const active =
            melMainAudible && curBeat >= n.start_beat && curBeat <= n.start_beat + n.duration_beats;

          ctx.globalAlpha = active ? 1 : melAlpha;
          ctx.fillStyle = active ? '#fef08a' : isAnchor ? '#fbbf24' : '#f59e0b';
          ctx.fillRect(nx, ny, nw, melH);

          if (isAnchor && melMainAudible) {
            ctx.strokeStyle = active ? '#ffffff' : 'rgba(254, 240, 138, 0.65)';
            ctx.lineWidth = Math.max(0.7, 1.2 * u);
            ctx.strokeRect(nx, ny, nw, melH);
          } else if (active) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.8, 1.4 * u);
            ctx.strokeRect(nx, ny, nw, melH);
          }

          if (active) {
            ctx.font = `700 ${(9.0 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(midiToNoteName(n.pitch), nx + 1.5 * u, Math.max(py0 + 6 * u, ny - 5 * u));
          }
        }

        ctx.globalAlpha = 1;
      }

      // =======================================================================
      // 4. SWEEPING WHITE PLAYHEAD
      // =======================================================================
      const headX = px0 + Math.max(0, Math.min(1, prog01)) * pw;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.0, 2.0 * u);
      ctx.beginPath();
      ctx.moveTo(headX, py0 - barHdrH);
      ctx.lineTo(headX, py0 + ph);
      ctx.stroke();

      const capR = 5.0 * u;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(headX - capR, py0 - barHdrH);
      ctx.lineTo(headX + capR, py0 - barHdrH);
      ctx.lineTo(headX, py0 - barHdrH + capR * 1.25);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = Math.max(0.6, 1.0 * u);
      ctx.strokeRect(px0, py0, pw, ph);

      // High-contrast callout when all 5 layers are muted (Intentional Silence)
      const allLayersSilent =
        !melMainAudible &&
        !spkAudible &&
        !chdAudible &&
        !basAudible &&
        !wndEnabled &&
        !tempRegionOn;
      if (allLayersSilent && pw > 120 * u && ph > 60 * u) {
        ctx.save();
        ctx.fillStyle = 'rgba(2, 5, 12, 0.72)';
        ctx.fillRect(px0, py0, pw, ph);

        const cardW = Math.min(pw - 24 * u, 520 * u);
        const cardH = Math.min(ph - 18 * u, 88 * u);
        const cardX = px0 + (pw - cardW) * 0.5;
        const cardY = py0 + (ph - cardH) * 0.5;

        drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 12 * u);
        ctx.fillStyle = 'rgba(8, 13, 25, 0.96)';
        ctx.fill();
        ctx.lineWidth = Math.max(0.8, 1.4 * u);
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.stroke();

        const titleTxt = pt
          ? 'Ative sua 1ª camada no tablet para acender a música'
          : 'Enable your 1st layer on the tablet to light up the music';
        const subTxt = pt
          ? 'Toque no olhinho de Melodia, Acordes, Baixo, Vento ou Temperatura'
          : 'Tap the eye toggle on Melody, Chords, Bass, Wind, or Temperature';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f8fafc';
        ctx.font = `700 ${(13.5 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
        ctx.fillText(titleTxt, cardX + cardW * 0.5, cardY + cardH * 0.37, cardW - 28 * u);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = `500 ${(10.2 * u).toFixed(2)}px 'Poppins', system-ui, sans-serif`;
        ctx.fillText(subTxt, cardX + cardW * 0.5, cardY + cardH * 0.67, cardW - 28 * u);
        ctx.restore();
      }

      ctx.restore();
      raf = window.requestAnimationFrame(renderFrame);
    };

    raf = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const seekFromOffsetX = useCallback(
    (offsetX: number) => {
      const metrics = layoutRef.current;
      if (!metrics) return;
      const { pianoBox } = metrics;
      const rawFrac = Math.max(0, Math.min(1, (offsetX - pianoBox.x) / Math.max(1, pianoBox.w)));
      seekProgress(rawFrac);
    },
    [seekProgress]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const metrics = layoutRef.current;
      if (!metrics) return;

      const x = e.nativeEvent.offsetX;
      const y = e.nativeEvent.offsetY;

      for (const lid of VISUAL_LAYER_ORDER) {
        const b = metrics.tileBoxes[lid];
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          e.stopPropagation();
          toggleEye(lid);
          return;
        }
      }

      const pb = metrics.pianoBox;
      if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
        e.stopPropagation();
        scrubbingRollRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        seekFromOffsetX(x);
      }
    },
    [interactive, seekFromOffsetX, toggleEye]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive || !scrubbingRollRef.current) return;
      e.stopPropagation();
      seekFromOffsetX(e.nativeEvent.offsetX);
    },
    [interactive, seekFromOffsetX]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!scrubbingRollRef.current) return;
    scrubbingRollRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const alpha2 = useMemo(
    () => (country ? COUNTRY_ID_TO_ALPHA2[country.id] ?? null : null),
    [country]
  );

  // Exact scale factor `u` matching the Canvas coordinate system 1:1 via CSS transform: scale(u)
  const u = Math.min(wallSize.w / 900, wallSize.h / 560);

  return (
    <div
      ref={rootRef}
      className="relative z-20 h-full w-full overflow-hidden bg-black font-['Poppins',system-ui,sans-serif] text-slate-50"
      style={{ backgroundColor: '#000000' }}
      data-testid="jukebox-studio-stage"
    >
      {/* Full-Wall 60fps Studio Canvas (100% width x 100% height — immune to DOM flex crush) */}
      <canvas
        ref={canvasRef}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        onPointerCancel={interactive ? handlePointerUp : undefined}
        className={`block h-full w-full bg-black ${interactive ? 'cursor-pointer' : 'pointer-events-none'}`}
        style={{ touchAction: interactive ? 'none' : 'auto', backgroundColor: '#000000' }}
        aria-label={
          isPt
            ? 'Estúdio Jukebox NASA: 5 camadas geográficas e partitura MIDI em tempo real'
            : 'NASA Jukebox Studio: 5 geographic layers and real-time MIDI score'
        }
      />

      {/* Top-Left Country Flag Overlay (transform: scale(u) -> exact 1:1 match with canvas header) */}
      {showTopHeader && alpha2 && (
        <div
          className="pointer-events-none absolute top-0 left-0 flex items-center justify-center overflow-hidden rounded-[3px] border border-slate-400/25 bg-slate-950"
          style={{
            width: '20px',
            height: '14px',
            transformOrigin: 'top left',
            transform: `translate(${(10 * u).toFixed(2)}px, ${(13 * u).toFixed(2)}px) scale(${u.toFixed(4)})`,
          }}
          aria-hidden="true"
        >
          <CountryFlagIcon code={alpha2} />
        </div>
      )}

      {/* Top-Right Mineiro3D + Typewriter Pill Overlay (transform: scale(u) -> fits exactly in the top bar without covering the maps) */}
      {showTopHeader && !hideRobot && (
        <div
          className="pointer-events-none absolute top-0 right-0 flex h-[34px] w-[328px] flex-nowrap items-center gap-2 overflow-hidden rounded-full border border-sky-400/35 bg-[#050d20]/94 pr-3.5 pl-1 shadow-[0_0_24px_rgba(14,165,233,0.18)]"
          style={{
            transformOrigin: 'top right',
            transform: `translate(${(-10 * u).toFixed(2)}px, ${(3 * u).toFixed(2)}px) scale(${u.toFixed(4)})`,
          }}
        >
          <div className="relative h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full border border-sky-400/40 bg-sky-500/15">
            <div
              style={{
                width: '62px',
                height: '62px',
                transformOrigin: 'top left',
                transform: 'scale(0.483)',
              }}
            >
              <Mineiro3D stepIndex={storyStep} isExplaining={speechStatus === 'speaking'} size="avatar" />
            </div>
          </div>

          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-none text-slate-100 whitespace-nowrap">
            {robotText}
            {speechStatus !== 'stopped' && speechStatus !== 'paused' && (
              <span
                className="ml-0.5 inline-block h-2.5 w-[1.5px] animate-pulse bg-sky-300 align-middle"
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      )}
    </div>
  );
};
