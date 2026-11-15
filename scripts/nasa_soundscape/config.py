"""
Configurações globais, papéis das camadas do Earth Jukebox, ganhos fixos e presets geográficos.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Arquitetura Earth Jukebox: 3 instrumentos, 1 regente e 1 bus de efeitos
INSTRUMENT_LAYERS: Tuple[str, ...] = ("chords", "bass", "melody")
CONDUCTOR_LAYER: str = "temperature"
EFFECT_LAYER: str = "wind"
ALL_LAYERS: Tuple[str, ...] = ("chords", "bass", "melody", "temperature", "wind")

LAYER_ROLES: Dict[str, str] = {
    "chords": "instrument",
    "bass": "instrument",
    "melody": "instrument",
    "temperature": "conductor",
    "wind": "effect",
}

VIDEO_FILES: Dict[str, str] = {
    "chords": "public/nasa/svs5153_co_2048x1024.mp4",
    "bass": "public/nasa/svs5154_nox_2048x1024.mp4",
    "melody": "public/nasa/svs5011_lightning_sos_4096x2048.mp4",
    "temperature": "public/nasa/svs5147_temp_2048x1024.mp4",
    "wind": "public/nasa/svs5148_wind_2048x1024.mp4",
}

# Aliases de compatibilidade com nomes antigos
LEGACY_LAYER_ALIASES: Dict[str, str] = {
    "harmony_co": "chords",
    "harmony": "chords",
    "co": "chords",
    "bass_no2": "bass",
    "no2": "bass",
    "melody_lightning": "melody",
    "lightning": "melody",
    "rhythm_temperature": "temperature",
    "rhythm": "temperature",
    "fx_wind": "wind",
    "fx": "wind",
}

# Ganho fixo por stem (constantes imutáveis — sem normalização relativa entre camadas)
STEM_GAINS: Dict[str, float] = {
    "chords": 0.720,
    "bass": 1.050,
    "melody": 0.880,
}

# Sub-ganho relativo da camada de tempestade/cintilação (5ª/8ª + shimmer agudo) dentro do stem da melodia
MELODY_SPARKLE_GAIN: float = 1.000

# Constantes da sessão "base" (quando o regente Temperatura está desligado: --tuning base)
BASE_SESSION_DEFAULTS: Dict[str, object] = {
    "tuning_mode": "base",
    "key_root": "A",
    "key_root_pc": 9,
    "key_root_pt": "Lá",
    "default_mode_id": "aeolian",
    "bpm": 90,
}

# Limiar do limitador suave aplicado exclusivamente no master
MASTER_LIMITER_THRESHOLD: float = 0.94


def normalize_layer_id(name: str) -> str:
    key = name.strip().lower()
    return LEGACY_LAYER_ALIASES.get(key, key)


@dataclass(frozen=True)
class GeoBoundingBox:
    """Caixa delimitadora geográfica em graus decimais (WGS84 / Plate Carrée)."""
    lat_min: float  # Sul (-90 a +90)
    lat_max: float  # Norte (-90 a +90)
    lon_min: float  # Oeste (-180 a +180)
    lon_max: float  # Leste (-180 a +180)
    name: str = "Região Selecionada"
    description: str = ""

    def validate(self) -> "GeoBoundingBox":
        lat_lo = max(-90.0, min(90.0, min(self.lat_min, self.lat_max)))
        lat_hi = max(-90.0, min(90.0, max(self.lat_min, self.lat_max)))
        lon_lo = max(-180.0, min(180.0, min(self.lon_min, self.lon_max)))
        lon_hi = max(-180.0, min(180.0, max(self.lon_min, self.lon_max)))
        if lat_hi - lat_lo < 0.5:
            lat_lo = max(-90.0, lat_lo - 0.5)
            lat_hi = min(90.0, lat_hi + 0.5)
        if lon_hi - lon_lo < 0.5:
            lon_lo = max(-180.0, lon_lo - 0.5)
            lon_hi = min(180.0, lon_hi + 0.5)
        return GeoBoundingBox(
            lat_min=lat_lo,
            lat_max=lat_hi,
            lon_min=lon_lo,
            lon_max=lon_hi,
            name=self.name,
            description=self.description,
        )

    @property
    def center_lat(self) -> float:
        return 0.5 * (self.lat_min + self.lat_max)

    @property
    def center_lon(self) -> float:
        return 0.5 * (self.lon_min + self.lon_max)


PRESET_REGIONS: Dict[str, GeoBoundingBox] = {
    "amazonia": GeoBoundingBox(
        lat_min=-12.0,
        lat_max=2.0,
        lon_min=-70.0,
        lon_max=-52.0,
        name="Amazônia Central (Brasil)",
        description="Alta atividade elétrica (raios), calor tropical intenso, plumas sazonais de CO e ventos de superfície calmos.",
    ),
    "congo": GeoBoundingBox(
        lat_min=-8.0,
        lat_max=5.0,
        lon_min=15.0,
        lon_max=30.0,
        name="Bacia do Congo (África Central)",
        description="Epicentro mundial de relâmpagos, clima quente equatorial e alta concentração de CO.",
    ),
    "leste_china": GeoBoundingBox(
        lat_min=28.0,
        lat_max=40.0,
        lon_min=112.0,
        lon_max=123.0,
        name="Leste da China (Xangai / Pequim)",
        description="Concentração urbana/industrial extrema de NO2 e CO (baixo e harmonia densos), clima temperado-quente e monções.",
    ),
    "saara": GeoBoundingBox(
        lat_min=18.0,
        lat_max=30.0,
        lon_min=0.0,
        lon_max=20.0,
        name="Deserto do Saara",
        description="Calor árido elevado (BPM alto), pouquíssimos raios (melodia contemplativa longa) e ar seco.",
    ),
    "europa": GeoBoundingBox(
        lat_min=44.0,
        lat_max=55.0,
        lon_min=-2.0,
        lon_max=16.0,
        name="Europa Ocidental e Central",
        description="Temperaturas amenas, ventos atlânticos moderados, NO2 urbano perceptível e poucos raios.",
    ),
    "oceano_austral": GeoBoundingBox(
        lat_min=-56.0,
        lat_max=-40.0,
        lon_min=45.0,
        lon_max=95.0,
        name="Oceano Austral (Roaring Forties)",
        description="Ventos oceânicos fortíssimos (muito espaço, reverb e movimento), ar puríssimo (baixo CO/NO2, modo Lídio) e águas frias.",
    ),
    "pacifico_equatorial": GeoBoundingBox(
        lat_min=-6.0,
        lat_max=8.0,
        lon_min=-155.0,
        lon_max=-125.0,
        name="Oceano Pacífico Equatorial",
        description="Águas quentes, ar limpo e calmo, mínima atividade de raios e atmosfera aberta.",
    ),
    "sudeste_brasil": GeoBoundingBox(
        lat_min=-25.5,
        lat_max=-18.5,
        lon_min=-50.0,
        lon_max=-41.0,
        name="Sudeste do Brasil (SP / RJ / MG)",
        description="Combinação equilibrada de raios tropicais, manchas urbanas de NO2, calor subtropical e brisa costeira.",
    ),
}
