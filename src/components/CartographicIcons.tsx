import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/** Inclined orbital telemetry reticle for mission mark */
export const OrbitalReticleIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="square"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="7" />
    <ellipse cx="12" cy="12" rx="11" ry="4.2" transform="rotate(-24 12 12)" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

/** 2x2 pixel-kernel sharpening grid for GPU CAS HD toggle */
export const SharpenKernelIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="square"
    aria-hidden="true"
    className={className}
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" fill="currentColor" fillOpacity="0.35" />
    <path d="M12 1v22M1 12h22" strokeOpacity="0.45" />
  </svg>
);

/** MINEIRØ ringed orb mascot silhouette */
export const MineiroOrbIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="6.5" />
    <ellipse cx="12" cy="12" rx="11" ry="3.4" transform="rotate(-28 12 12)" />
    <circle cx="10.2" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

/** Astronaut EVA helmet visor silhouette */
export const EvaHelmetIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M5 13a7 7 0 0 1 14 0v2.5A4.5 4.5 0 0 1 14.5 20h-5A4.5 4.5 0 0 1 5 15.5V13Z" />
    <rect x="7.5" y="9" width="9" height="5.5" rx="2.2" />
    <path d="M9.5 11.2h1.5M13 11.2h1.5" />
    <path d="M4 12.5H2.5v3H4M20 12.5h1.5v3H20" />
  </svg>
);

/** Atmospheric electrical discharge vector (SVS 5011) */
export const LightningBoltIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
    className={className}
  >
    <polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2" />
  </svg>
);

/** Meteorological isotherm thermal scale (SVS 5147) */
export const IsothermIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3 7c3.5-2.5 6.5 2.5 10 0s5.5-2 8 0" />
    <path d="M3 12.5c3.5-2.5 6.5 2.5 10 0s5.5-2 8 0" />
    <path d="M3 18c3.5-2.5 6.5 2.5 10 0s5.5-2 8 0" />
  </svg>
);

/** Meteorological surface wind barb (SVS 5148) */
export const WindBarbIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="6" cy="18" r="2.2" />
    <path d="M7.6 16.4 19.5 4.5" />
    <path d="M19.5 4.5 15 3.5" />
    <path d="M16.5 7.5 12.5 6.5" />
    <path d="M13.5 10.5 11 9.8" />
  </svg>
);

/** Atmospheric CO spectral plume bands (SVS 5153) */
export const SpectralBandIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="square"
    aria-hidden="true"
    className={className}
  >
    <rect x="3" y="4" width="18" height="16" />
    <line x1="7" y1="8" x2="7" y2="16" />
    <line x1="11" y1="6" x2="11" y2="18" />
    <line x1="14.5" y1="9" x2="14.5" y2="15" />
    <line x1="17.5" y1="7" x2="17.5" y2="17" />
  </svg>
);

/** Nitrogen dioxide / NOx molecular geometry (SVS 5154) */
export const No2MoleculeIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="7.5" r="2.6" />
    <circle cx="5.5" cy="17" r="2.4" />
    <circle cx="18.5" cy="17" r="2.4" />
    <line x1="10.4" y1="9.7" x2="7" y2="14.8" />
    <line x1="13.6" y1="9.7" x2="17" y2="14.8" />
  </svg>
);

/** Vector country polygon border glyph */
export const PolygonBorderIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="miter"
    aria-hidden="true"
    className={className}
  >
    <polygon points="5 4 17 3 20 11 14 20 4 17 6 10 5 4" />
    <circle cx="5" cy="4" r="1.2" fill="currentColor" />
    <circle cx="17" cy="3" r="1.2" fill="currentColor" />
    <circle cx="20" cy="11" r="1.2" fill="currentColor" />
    <circle cx="14" cy="20" r="1.2" fill="currentColor" />
    <circle cx="4" cy="17" r="1.2" fill="currentColor" />
  </svg>
);

/** Geodetic lat/lon graticule sphere glyph */
export const GraticuleIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M4.5 7.5h15M4.5 16.5h15" />
  </svg>
);

export type StemIconCategory = 'melody' | 'harmony' | 'rhythm' | 'bass' | 'fx';

/** Shared authored glyph for each musical Earth layer across Launchpad, Jukebox & Live Bar */
export const StemLayerIcon: React.FC<{
  stem: StemIconCategory;
  size?: number;
  className?: string;
}> = ({ stem, size = 15, className }) => {
  switch (stem) {
    case 'melody':
      return <LightningBoltIcon size={size} className={className} />;
    case 'harmony':
      return <SpectralBandIcon size={size} className={className} />;
    case 'rhythm':
      return <IsothermIcon size={size} className={className} />;
    case 'bass':
      return <No2MoleculeIcon size={size} className={className} />;
    case 'fx':
      return <WindBarbIcon size={size} className={className} />;
  }
};
