import React from 'react';
import { Mineiro3D } from '../components/Mineiro3D';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps } from '../experience/types';

/**
 * Superfície Projetada — PAREDE DIREITA (`rightWall` · Projetor 1 Canto em L):
 * Robozinho (`Mineiro3D`) dando as instruções e contando a história do país em `#000000` absoluto,
 * sincronizado com o Tablet via `storyStep` no `useExperience()`.
 * Propriedade criativa 100% livre da Shay (Pessoa 1).
 */
export const RightWallScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const { country, lang, layers, playback, storyStep } = useExperience();
  const isPt = lang === 'pt';
  const countryName = country ? (isPt ? country.namePt : country.nameEn) : isPt ? 'a Terra' : 'Earth';

  const storyMessages = isPt
    ? [
        {
          kicker: 'Boas-vindas · Earth Jukebox',
          title: `Ouvindo os satélites sobre ${countryName}`,
          body: 'Toque em qualquer país no Tablet e olhe para o Teto: as 5 camadas reais da NASA se acendem acima de você.',
        },
        {
          kicker: 'Camadas Estilo Photoshop',
          title: 'Ligue e desligue os Olhinhos no Tablet',
          body: 'Cada fenômeno atmosférico controla um instrumento: Raios tocam a melodia, CO cria acordes e NO₂ pulsa no grave.',
        },
        {
          kicker: 'Regente Climático & Vento 8D',
          title: `${playback.bpm} BPM em ${playback.keyRootPt} · ${playback.activeChord}`,
          body: layers.temperature.enabled
            ? 'A Temperatura real deste território está regendo o ritmo e o tom da música agora.'
            : 'Temperatura desligada: comparando com a base neutra científica (Lá · 90 BPM).',
        },
        {
          kicker: 'Áudio Espacial na Sala',
          title: `Vento médio de ${playback.windMeanSpeed.toFixed(1)} m/s`,
          body: 'Os relâmpagos viajam pelo espaço 3D onde caíram de verdade e os ventos fazem o som orbitar ao seu redor.',
        },
      ]
    : [
        {
          kicker: 'Welcome · Earth Jukebox',
          title: `Listening to NASA satellites over ${countryName}`,
          body: 'Pick any country on the Tablet and look up at the Ceiling: all 5 NASA data layers light up above you.',
        },
        {
          kicker: 'Photoshop-Style Layers',
          title: 'Toggle the Layer Eyes on the Tablet',
          body: 'Each atmospheric dataset plays an instrument: Lightning drives melody, CO shapes chords, and NO₂ anchors the bass.',
        },
        {
          kicker: 'Climate Conductor & 8D Wind',
          title: `${playback.bpm} BPM in ${playback.keyRoot} · ${playback.activeChord}`,
          body: layers.temperature.enabled
            ? 'Real surface temperature in this territory is conducting the tempo and musical key.'
            : 'Temperature eye off: comparing against the neutral reference (A · 90 BPM).',
        },
        {
          kicker: 'Spatial Room Audio',
          title: `Mean wind speed ${playback.windMeanSpeed.toFixed(1)} m/s`,
          body: 'Lightning notes fire from their real coordinates while surface winds spin the soundscape in 8D around the room.',
        },
      ];

  const currentStory = storyMessages[storyStep % storyMessages.length] ?? storyMessages[0];

  return (
    <section
      className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden bg-black p-6 text-center text-slate-50 select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="rightWall"
      data-render-context={renderContext}
    >
      <div className="h-52 w-52 shrink-0 sm:h-64 sm:w-64">
        <Mineiro3D
          stepIndex={storyStep}
          isExplaining={playback.isPlaying || storyStep > 0}
          size="full"
        />
      </div>

      <div className="max-w-md">
        <span className="text-[11px] font-semibold tracking-widest text-sky-400 uppercase">
          {currentStory.kicker}
        </span>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          {currentStory.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{currentStory.body}</p>
      </div>
    </section>
  );
};
