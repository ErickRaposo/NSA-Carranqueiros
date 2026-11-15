import React, { useEffect, useMemo, useState } from 'react';
import { CameraViewTarget, EarthCanvas } from '../components/EarthCanvas';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps } from '../experience/types';
import { loadWorldCountries } from '../geo/countries';
import { buildGlobeLayerStack, useNasaVideoPool } from '../hooks/useNasaVideoPool';
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
    selectCountry,
  } = useExperience();
  const world = useMemo(() => loadWorldCountries(), []);

  const globeLayerStack = useMemo(() => buildGlobeLayerStack(layers), [layers]);
  const videoElements = useNasaVideoPool(globeLayerStack, renderContext !== 'demo');

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
      (missionPhase === 'exploring' && storyStep === 0 && !playback.isPlaying);
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
    playback.isPlaying,
    storyStep,
  ]);

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="leftWall"
      data-render-context={renderContext}
    >
      <EarthCanvas
        videoElements={videoElements}
        layers={globeLayerStack}
        viewMode={isCountryFocused2D ? '2d' : '3d'}
        visualStyle="bioluminescent"
        backgroundHex="#000000"
        orbitAutoRotate={!isCountryFocused2D && (!country || missionPhase !== 'exploring' || storyStep === 0)}
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
        selectedCountry={selectedGeoEntry}
        jukeboxPlaying={playback.isPlaying}
        flyTarget={flyTarget}
        onHoverChange={() => {}}
        onCameraDistanceChange={() => {}}
        onSelectCountry={(entry) => {
          if (entry) selectCountry(entry.id);
        }}
      />

      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-80">
        <SpaceStarfield seedOffset={1} count={64} />
      </div>

      <SpaceshipLaunchOverlay surface="leftWall" phase={missionPhase} />
    </section>
  );
};
