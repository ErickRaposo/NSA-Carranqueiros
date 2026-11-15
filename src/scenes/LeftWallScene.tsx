import React, { useEffect, useMemo, useState } from 'react';
import { CameraViewTarget, EarthCanvas } from '../components/EarthCanvas';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps } from '../experience/types';
import { loadWorldCountries } from '../geo/countries';
import { buildGlobeLayerStack, useNasaVideoPool } from '../hooks/useNasaVideoPool';

/**
 * Superfície Projetada — PAREDE ESQUERDA (`leftWall` · Projetor 1 Canto em L):
 * Globo inteiro (3D/2D) focado no planeta e no país selecionado sobre `#000000` absoluto.
 * Propriedade criativa 100% livre da Shay (Pessoa 1).
 */
export const LeftWallScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const { country, availableCountryIds, lang, layers, playback, selectCountry } = useExperience();
  const isPt = lang === 'pt';
  const world = useMemo(() => loadWorldCountries(), []);

  const globeLayerStack = useMemo(() => buildGlobeLayerStack(layers), [layers]);
  const videoElements = useNasaVideoPool(globeLayerStack, renderContext !== 'demo');

  const selectedGeoEntry = useMemo(
    () => (country ? world.countries.find((c) => c.id === country.id) ?? null : null),
    [country, world.countries]
  );

  const [flyTarget, setFlyTarget] = useState<CameraViewTarget | null>(null);

  useEffect(() => {
    if (!country) return;
    setFlyTarget({
      lon: country.lon,
      lat: country.lat,
      distance: country.idealDistance,
      nonce: Date.now(),
    });
  }, [country?.id, country?.idealDistance, country?.lat, country?.lon]);

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black text-slate-50 select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="leftWall"
      data-render-context={renderContext}
    >
      <EarthCanvas
        videoElements={videoElements}
        layers={globeLayerStack}
        viewMode="3d"
        visualStyle="bioluminescent"
        backgroundHex="#000000"
        orbitAutoRotate={!country}
        showBorders={true}
        showGrid={false}
        showLabels={true}
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

      <div className="pointer-events-none absolute bottom-5 left-6 z-10">
        <div className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {country ? (isPt ? country.regionPt : country.regionEn) : 'Earth Jukebox'}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">
          {country ? (isPt ? country.namePt : country.nameEn) : 'Terra'}
        </h2>
      </div>
    </section>
  );
};
