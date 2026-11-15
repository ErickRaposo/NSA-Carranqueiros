import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CameraViewTarget, EarthCanvas } from '../components/EarthCanvas';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps } from '../experience/types';
import { loadWorldCountries } from '../geo/countries';
import { buildGlobeLayerStack, useNasaVideoPool } from '../hooks/useNasaVideoPool';
import { IdlePanoramaBridge } from './IdlePanoramaBridge';
import { SpaceStarfield } from './SpaceStarfield';
import { SpaceshipLaunchOverlay } from './SpaceshipLaunchOverlay';

/**
 * Superfície Projetada — PAREDE ESQUERDA (`leftWall` · Projetor 1 Canto em L):
 * - `boarding` / `countdown`: janelinha da nave vendo a torre de lançamento e pessoas lá embaixo.
 * - `zero_g` (4s): cabine espacial em volta do Globo que desaparece após 4 segundos.
 * - `idle` / `exploring` / `ended`: Globo inteiro no espaço `#000000` estrelado.
 */
export const LeftWallScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const {
    country,
    availableCountryIds,
    lang,
    layers,
    missionPhase,
    playback,
    storyStep,
  } = useExperience();
  const world = useMemo(() => loadWorldCountries(), []);

  const globeLayerStack = useMemo(() => buildGlobeLayerStack(layers), [layers]);
  const videoElements = useNasaVideoPool(
    globeLayerStack,
    renderContext !== 'demo' || playback.isPlaying
  );

  const selectedGeoEntry = useMemo(
    () => (country ? world.countries.find((c) => c.id === country.id) ?? null : null),
    [country, world.countries]
  );

  const [flyTarget, setFlyTarget] = useState<CameraViewTarget | null>(null);
  const isCountryFocused2D =
    missionPhase === 'exploring' && storyStep > 0 && Boolean(country);

  useEffect(() => {
    const isOverview =
      missionPhase === 'idle' ||
      missionPhase === 'ended' ||
      (missionPhase === 'exploring' && storyStep === 0);
    if (!country && !isOverview && missionPhase !== 'zero_g') return;

    setFlyTarget({
      lon: country?.lon ?? -47,
      lat: country?.lat ?? -14,
      distance:
        missionPhase === 'ended'
          ? 2.65
          : missionPhase === 'zero_g'
            ? country
              ? Math.min(3.05, (country.idealDistance ?? 2.4) + 0.3)
              : 2.85
            : isCountryFocused2D
              ? Math.max(1.55, country?.idealDistance ?? 2.05)
              : isOverview
                ? 3.8
                : Math.min(3.8, (country?.idealDistance ?? 2.4) + 0.55),
      nonce: Date.now(),
    });
  }, [
    country?.id,
    country?.idealDistance,
    country?.lat,
    country?.lon,
    isCountryFocused2D,
    missionPhase,
    storyStep,
  ]);

  const isOverviewMode =
    missionPhase === 'idle' ||
    missionPhase === 'briefing' ||
    missionPhase === 'ended' ||
    (missionPhase === 'exploring' && storyStep === 0);

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="leftWall"
      data-render-context={renderContext}
    >
      {/* Luzinha azul destacando o Globo em repouso/espera + pulso atmosférico orbital */}
      {missionPhase === 'idle' && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center mix-blend-screen"
          aria-hidden="true"
        >
          <motion.div
            className="h-[520px] w-[520px] rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.14) 38%, rgba(2,132,199,0.04) 58%, transparent 74%)',
            }}
            animate={{ scale: [0.96, 1.05, 0.96], opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            className="ceiling-orbit-cw absolute top-1/2 left-1/2 h-0 w-0"
            style={{ animationDuration: '14s' }}
          >
            <div style={{ transform: 'translateX(218px)' }}>
              <span
                className="block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200"
                style={{
                  boxShadow:
                    '0 0 18px 6px rgba(56, 189, 248, 0.85), 0 0 42px 14px rgba(14, 165, 233, 0.45)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      <motion.div
        className="h-full w-full"
        animate={missionPhase === 'idle' ? { y: [-5, 5, -5] } : { y: 0 }}
        transition={
          missionPhase === 'idle'
            ? { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.4 }
        }
      >
        <EarthCanvas
          videoElements={videoElements}
          layers={globeLayerStack}
          viewMode={isCountryFocused2D ? '2d' : '3d'}
          visualStyle="bioluminescent"
          backgroundHex="#000000"
          orbitAutoRotate={!isCountryFocused2D && (!country || isOverviewMode)}
          autoRotateSpeedDegPerSec={
            missionPhase === 'idle' ? 11.5 : missionPhase === 'briefing' ? 5.2 : 1.92
          }
          blueHighlightBoost={
            missionPhase === 'idle' ? 1 : missionPhase === 'briefing' ? 0.5 : 0
          }
          showBorders={true}
          showGrid={false}
          showLabels={false}
          highContrast={false}
          lang={lang}
          availableCountryIds={availableCountryIds}
          countries={world.countries}
          allRings={world.allRings}
          landBorderRings={world.landBorderRings}
          coastlineRings={world.coastlineRings}
          selectedCountry={
            missionPhase === 'idle' || missionPhase === 'briefing' ? null : selectedGeoEntry
          }
          jukeboxPlaying={playback.isPlaying}
          interactive={false}
          flyTarget={flyTarget}
          onHoverChange={() => {}}
          onCameraDistanceChange={() => {}}
          onSelectCountry={() => {}}
        />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-80">
        <SpaceStarfield seedOffset={1} count={missionPhase === 'idle' ? 92 : 64} />
      </div>

      {/* Astros espaciais espalhados + camada mapeada cruzando para a Parede Direita em idle */}
      {missionPhase === 'idle' && (
        <>
          <motion.div
            className="pointer-events-none absolute top-[19%] left-[12%] z-10"
            animate={{ y: [-7, 7, -7], x: [-4, 4, -4] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <div
              className="h-9 w-9 rounded-full opacity-90"
              style={{
                background:
                  'radial-gradient(circle at 30% 28%, #e0e7ff 0%, #6366f1 56%, #1e1b4b 100%)',
                boxShadow: '0 0 20px rgba(129, 140, 248, 0.42)',
              }}
            />
          </motion.div>

          <motion.div
            className="pointer-events-none absolute top-[24%] left-[86%] z-10"
            animate={{ y: [6, -6, 6] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <div className="relative flex items-center justify-center">
              <div
                className="pointer-events-none absolute rounded-full border border-sky-200/45"
                style={{
                  width: '54px',
                  height: '15px',
                  transform: 'rotate(18deg)',
                }}
              />
              <div
                className="h-7 w-7 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 32% 28%, #cffafe 0%, #06b6d4 58%, #164e63 100%)',
                  boxShadow: '0 0 18px rgba(34, 211, 238, 0.45)',
                }}
              />
            </div>
          </motion.div>

          <IdlePanoramaBridge surface="leftWall" />
        </>
      )}

      <SpaceshipLaunchOverlay surface="leftWall" phase={missionPhase} />
    </section>
  );
};
