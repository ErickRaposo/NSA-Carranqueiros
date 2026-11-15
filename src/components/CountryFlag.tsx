import React from 'react';
import { Globe } from 'lucide-react';

export interface OriginCountryOption {
  code: string;
  namePt: string;
}

export const ORIGIN_COUNTRY_OPTIONS: OriginCountryOption[] = [
  { code: 'BR', namePt: 'Brasil' },
  { code: 'PT', namePt: 'Portugal' },
  { code: 'US', namePt: 'Estados Unidos' },
  { code: 'AR', namePt: 'Argentina' },
  { code: 'CA', namePt: 'Canadá' },
  { code: 'MX', namePt: 'México' },
  { code: 'CO', namePt: 'Colômbia' },
  { code: 'CL', namePt: 'Chile' },
  { code: 'UY', namePt: 'Uruguai' },
  { code: 'PE', namePt: 'Peru' },
  { code: 'FR', namePt: 'França' },
  { code: 'DE', namePt: 'Alemanha' },
  { code: 'GB', namePt: 'Reino Unido' },
  { code: 'ES', namePt: 'Espanha' },
  { code: 'IT', namePt: 'Itália' },
  { code: 'JP', namePt: 'Japão' },
  { code: 'IN', namePt: 'Índia' },
  { code: 'KR', namePt: 'Coreia do Sul' },
  { code: 'AU', namePt: 'Austrália' },
  { code: 'ZA', namePt: 'África do Sul' },
  { code: 'AO', namePt: 'Angola' },
  { code: 'MZ', namePt: 'Moçambique' },
];

export const ALL_ISO_ALPHA2_CODES: string[] = [
  'AF', 'ZA', 'AL', 'DE', 'AD', 'AO', 'AG', 'SA', 'DZ', 'AR', 'AM', 'AU', 'AT', 'AZ',
  'BS', 'BD', 'BB', 'BH', 'BE', 'BZ', 'BJ', 'BY', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG',
  'BF', 'BI', 'BT', 'CV', 'CM', 'KH', 'CA', 'QA', 'KZ', 'TD', 'CL', 'CY', 'SG',
  'CO', 'KM', 'CG', 'CD', 'KP', 'KR', 'CI', 'CR', 'HR', 'CU', 'DK', 'DJ', 'DM', 'EG',
  'SV', 'AE', 'EC', 'ER', 'SK', 'SI', 'ES', 'US', 'EE', 'SZ', 'ET', 'FJ', 'PH', 'FI',
  'FR', 'GA', 'GM', 'GH', 'GE', 'GD', 'GR', 'GT', 'GY', 'GN', 'GW', 'GQ', 'HT', 'HN',
  'HU', 'YE', 'MH', 'SB', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IS', 'IL', 'IT', 'JM', 'JP',
  'JO', 'KI', 'KW', 'LA', 'LS', 'LV', 'LB', 'LR', 'LY', 'LI', 'LT', 'LU', 'MK', 'MG',
  'MY', 'MW', 'MV', 'ML', 'MT', 'MA', 'MU', 'MR', 'MX', 'FM', 'MZ', 'MD', 'MC', 'MN',
  'ME', 'MM', 'NA', 'NR', 'NP', 'NI', 'NE', 'NG', 'NO', 'NZ', 'OM', 'NL', 'PW', 'PA',
  'PG', 'PK', 'PY', 'PE', 'PL', 'PT', 'KE', 'KG', 'GB', 'CF', 'CZ', 'DO', 'RO', 'RW',
  'RU', 'WS', 'SM', 'LC', 'KN', 'ST', 'VC', 'SC', 'SN', 'SL', 'RS', 'SY', 'SO', 'LK',
  'SD', 'SS', 'SE', 'CH', 'SR', 'TH', 'TW', 'TJ', 'TZ', 'TL', 'TG', 'TO', 'TT', 'TN',
  'TM', 'TR', 'TV', 'UA', 'UG', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'ZM', 'ZW',
];

const PT_COUNTRY_OVERRIDES: Record<string, string> = Object.fromEntries(
  ORIGIN_COUNTRY_OPTIONS.map((o) => [o.code, o.namePt])
);

const regionDisplayNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['pt-BR'], { type: 'region' })
    : null;

export const ALL_COUNTRY_OPTIONS: OriginCountryOption[] = ALL_ISO_ALPHA2_CODES.map((code) => ({
  code,
  namePt: PT_COUNTRY_OVERRIDES[code] || regionDisplayNames?.of(code) || code,
})).sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));

export function getOriginCountryNamePt(code?: string | null): string {
  if (!code) return 'Órbita Livre';
  const normalized = code.trim().toUpperCase();
  const match = ALL_COUNTRY_OPTIONS.find((opt) => opt.code === normalized);
  return match ? match.namePt : regionDisplayNames?.of(normalized) || normalized;
}

function renderVectorFlagSvg(code: string): React.ReactNode {
  switch (code) {
    case 'BR':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" rx="2.2" fill="#009b3a" />
          <polygon points="10,1.8 18,7 10,12.2 2,7" fill="#fedf00" />
          <circle cx="10" cy="7" r="3" fill="#002776" />
        </svg>
      );
    case 'PT':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" rx="2.2" fill="#ff0000" />
          <rect width="8" height="14" rx="2.2" fill="#006600" />
          <circle cx="8" cy="7" r="2.5" fill="#ffcc00" />
        </svg>
      );
    case 'US':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" rx="2.2" fill="#b22234" />
          <rect y="2" width="20" height="2" fill="#ffffff" />
          <rect y="6" width="20" height="2" fill="#ffffff" />
          <rect y="10" width="20" height="2" fill="#ffffff" />
          <rect width="9" height="8" rx="1.5" fill="#3c3b6e" />
        </svg>
      );
    case 'FR':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="7" height="14" fill="#0055a4" />
          <rect x="6.5" width="7" height="14" fill="#ffffff" />
          <rect x="13" width="7" height="14" fill="#ef4135" />
        </svg>
      );
    case 'DE':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="4.7" fill="#18181b" />
          <rect y="4.6" width="20" height="4.8" fill="#dd0000" />
          <rect y="9.3" width="20" height="4.7" fill="#ffce00" />
        </svg>
      );
    case 'JP':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" rx="2.2" fill="#ffffff" />
          <circle cx="10" cy="7" r="3.8" fill="#bc002d" />
        </svg>
      );
    case 'AR':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#74acdf" />
          <rect y="4.6" width="20" height="4.8" fill="#ffffff" />
          <circle cx="10" cy="7" r="1.5" fill="#f6b40e" />
        </svg>
      );
    case 'ES':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#aa151b" />
          <rect y="3.5" width="20" height="7" fill="#f1bf00" />
        </svg>
      );
    case 'IT':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="7" height="14" fill="#009246" />
          <rect x="6.5" width="7" height="14" fill="#ffffff" />
          <rect x="13" width="7" height="14" fill="#ce2b37" />
        </svg>
      );
    case 'GB':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#012169" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#ffffff" strokeWidth="2.6" />
          <path d="M10,0 V14 M0,7 H20" stroke="#ffffff" strokeWidth="4.2" />
          <path d="M10,0 V14 M0,7 H20" stroke="#c8102e" strokeWidth="2.4" />
        </svg>
      );
    case 'CA':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#ff0000" />
          <rect x="5" width="10" height="14" fill="#ffffff" />
          <polygon points="10,3.5 12.2,7.5 10,7 10,10.5 10,7 7.8,7.5" fill="#ff0000" />
          <circle cx="10" cy="6.8" r="2" fill="#ff0000" />
        </svg>
      );
    case 'MX':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="7" height="14" fill="#006847" />
          <rect x="6.5" width="7" height="14" fill="#ffffff" />
          <rect x="13" width="7" height="14" fill="#ce1126" />
          <circle cx="10" cy="7" r="1.4" fill="#854d0e" />
        </svg>
      );
    case 'CO':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="7" fill="#fcd116" />
          <rect y="7" width="20" height="3.5" fill="#003893" />
          <rect y="10.5" width="20" height="3.5" fill="#ce1126" />
        </svg>
      );
    case 'CL':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="7" fill="#ffffff" />
          <rect width="7" height="7" fill="#0039a6" />
          <rect y="7" width="20" height="7" fill="#d52b1e" />
          <circle cx="3.5" cy="3.5" r="1.2" fill="#ffffff" />
        </svg>
      );
    case 'IN':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="4.7" fill="#ff9933" />
          <rect y="4.6" width="20" height="4.8" fill="#ffffff" />
          <rect y="9.3" width="20" height="4.7" fill="#138808" />
          <circle cx="10" cy="7" r="1.5" fill="#000080" />
        </svg>
      );
    case 'UY':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#ffffff" />
          <rect y="2.2" width="20" height="1.8" fill="#0038a8" />
          <rect y="5.6" width="20" height="1.8" fill="#0038a8" />
          <rect y="9.0" width="20" height="1.8" fill="#0038a8" />
          <rect y="12.2" width="20" height="1.8" fill="#0038a8" />
          <rect width="8" height="7" fill="#ffffff" />
          <circle cx="4" cy="3.5" r="1.8" fill="#fcd116" />
        </svg>
      );
    case 'PE':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="7" height="14" fill="#d91023" />
          <rect x="6.5" width="7" height="14" fill="#ffffff" />
          <rect x="13" width="7" height="14" fill="#d91023" />
        </svg>
      );
    case 'KR':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#ffffff" />
          <circle cx="10" cy="7" r="3.4" fill="#cd2e3a" />
          <path d="M6.6,7 A3.4,3.4 0 0,0 13.4,7 Z" fill="#0047a0" />
        </svg>
      );
    case 'AU':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" fill="#00008b" />
          <rect width="9" height="7" fill="#012169" />
          <path d="M4.5,0 V7 M0,3.5 H9" stroke="#ffffff" strokeWidth="1.8" />
          <path d="M4.5,0 V7 M0,3.5 H9" stroke="#e4002b" strokeWidth="1" />
          <circle cx="15" cy="4" r="1" fill="#ffffff" />
          <circle cx="13" cy="8" r="0.9" fill="#ffffff" />
          <circle cx="16.5" cy="9" r="0.9" fill="#ffffff" />
        </svg>
      );
    case 'ZA':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="7" fill="#e03c31" />
          <rect y="7" width="20" height="7" fill="#001489" />
          <path d="M0,0 L9,7 L0,14 Z" fill="#000000" />
          <path d="M0,0 L9,7 L20,7 M0,14 L9,7" stroke="#007749" strokeWidth="2.8" fill="none" />
        </svg>
      );
    case 'AO':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="7" fill="#cc092f" />
          <rect y="7" width="20" height="7" fill="#000000" />
          <circle cx="10" cy="7" r="2.2" fill="none" stroke="#ffcb00" strokeWidth="1.2" />
        </svg>
      );
    case 'MZ':
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="4.7" fill="#007168" />
          <rect y="4.6" width="20" height="4.8" fill="#000000" />
          <rect y="9.3" width="20" height="4.7" fill="#fce100" />
          <polygon points="0,0 8.5,7 0,14" fill="#d21034" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 14" className="country-flag-svg" aria-hidden="true">
          <rect width="20" height="14" rx="2.2" fill="#0f2942" />
          <text
            x="10"
            y="9.5"
            textAnchor="middle"
            fill="#bae6fd"
            fontSize="7"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            {code.slice(0, 2)}
          </text>
        </svg>
      );
  }
}

const FLAG_ICON_CODE_SET = new Set(ALL_ISO_ALPHA2_CODES);

export const CountryFlagIcon: React.FC<{ code?: string | null }> = ({ code }) => {
  const normalized = code?.trim().toUpperCase() || null;

  if (!normalized) {
    return (
      <span className="country-flag-icon-wrap" aria-hidden="true">
        <Globe size={14} />
      </span>
    );
  }

  if (FLAG_ICON_CODE_SET.has(normalized) || /^[A-Z]{2}$/.test(normalized)) {
    return (
      <span className="country-flag-icon-wrap" aria-hidden="true">
        <span
          className={`fi fi-${normalized.toLowerCase()} block shrink-0 rounded-[2px]`}
          style={{
            width: '20px',
            height: '15px',
            backgroundSize: 'cover',
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.14)',
          }}
        />
      </span>
    );
  }

  return (
    <span className="country-flag-icon-wrap" aria-hidden="true">
      {renderVectorFlagSvg(normalized)}
    </span>
  );
};

interface CountryFlagBadgeProps {
  code?: string | null;
  showName?: boolean;
  compactOnSmall?: boolean;
}

export const CountryFlagBadge: React.FC<CountryFlagBadgeProps> = ({
  code,
  showName = true,
  compactOnSmall = false,
}) => {
  const normalized = code?.trim().toUpperCase() || null;
  const countryName = getOriginCountryNamePt(normalized);

  return (
    <span
      className="country-flag-badge"
      title={`País de origem: ${countryName}`}
      data-testid="player-country-flag"
    >
      <span className="country-flag-icon-wrap" aria-hidden="true">
        {normalized ? (
          FLAG_ICON_CODE_SET.has(normalized) || /^[A-Z]{2}$/.test(normalized) ? (
            <span
              className={`fi fi-${normalized.toLowerCase()} block shrink-0 rounded-[2px]`}
              style={{
                width: '15px',
                height: '11px',
                backgroundSize: 'cover',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.14)',
              }}
            />
          ) : (
            renderVectorFlagSvg(normalized)
          )
        ) : (
          <Globe size={12} />
        )}
      </span>
      {showName ? (
        <span className={`country-flag-name ${compactOnSmall ? 'hide-country-xs' : ''}`}>
          {countryName}
        </span>
      ) : (
        <span className="sr-only">{countryName}</span>
      )}
    </span>
  );
};
