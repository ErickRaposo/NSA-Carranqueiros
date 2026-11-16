"""
Earth Jukebox Music Engine: Frozen Control Plan + 3 Independent Instruments.

Architecture:
  - Phase 1 (`build_control_plan`): computes and freezes `session` (`base` and `region`),
    `harmony_plan` (1 chord/bar anchored to the active key), and isolated control curves
    per layer (including melody scan cursors and wind bus parameters).
    The plan NEVER changes when toggling instruments or the wind effect on/off.
  - Phase 2 (Independent per-instrument composition):
      * `compose_chords_instrument`  (CO -> 3–5 voice pad, continuous mode, voice-leading)
      * `compose_bass_instrument`    (NO2 -> Continuous bass line from image columns)
      * `compose_melody_instrument`  (Lightning -> Neutral suspended pentatonic, scan/time,
                                      memory/anchors, and adaptive density within bar cap)
"""

from dataclasses import asdict, dataclass, field
import math
from typing import Dict, List, Optional, Tuple
import numpy as np

from .config import BASE_SESSION_DEFAULTS, STEM_GAINS, VIDEO_FILES, GeoBoundingBox
from .geo_extractor import LayerFeatures, LightningEvent, SpatialFlashPoint

NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
NOTE_NAMES_PT = {
    "C": "Dó",
    "C#": "Dó#",
    "D": "Ré",
    "Eb": "Mi bemol",
    "E": "Mi",
    "F": "Fá",
    "F#": "Fá#",
    "G": "Sol",
    "Ab": "Lá bemol",
    "A": "Lá",
    "Bb": "Si bemol",
    "B": "Si",
}

CIRCLE_OF_FIFTHS_SEMITONES = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]

# Neutral suspended pentatonic (1, 2, 4, 5, b7): no third or sixth, consonant from Lydian to Phrygian
NEUTRAL_SUSPENDED_PENTATONIC_IV = [0, 2, 5, 7, 10]


@dataclass
class NoteEvent:
    """Individual musical note linked to the image coordinate (source_x, source_y)."""
    pitch: int
    note_name: str
    start_beat: float
    duration_beats: float
    velocity: float
    layer: str
    bar: int = 0
    source_x: float = 0.5
    source_y: float = 0.5
    source_intensity: float = 0.5
    cutoff_hz: Optional[float] = None
    drive: Optional[float] = None
    attack_sec: Optional[float] = None
    release_sec: Optional[float] = None
    brightness: Optional[float] = None
    harmonic_partials: Optional[float] = None
    is_anchor: bool = False
    persistence: float = 0.0
    cluster_size: int = 1
    sub_role: str = "main"


@dataclass
class ChordSection:
    """Active chord in a bar of `harmony_plan`."""
    bar: int
    symbol: str
    degree_label: str
    function_pt: str
    start_beat: float
    duration_beats: float
    root_pc: int
    third_pc: int
    fifth_pc: int
    midi_notes: List[int]
    note_names: List[str]
    source_x: float = 0.5
    source_y: float = 0.5
    co_local: float = 0.3
    mode_id: str = "ionian"
    scale_pcs: List[int] = field(default_factory=lambda: [0, 2, 4, 5, 7, 9, 11])


def midi_to_name(midi_pitch: int) -> str:
    pc = midi_pitch % 12
    octave = (midi_pitch // 12) - 1
    return f"{NOTE_NAMES[pc]}{octave}"


def resample_curve(series: List[float], target_len: int, default_val: float = 0.3) -> List[float]:
    if target_len <= 0:
        return []
    if not series:
        return [default_val] * target_len
    if len(series) == target_len:
        return list(series)
    out: List[float] = []
    n = len(series)
    for i in range(target_len):
        pos = (i / max(1, target_len - 1)) * (n - 1)
        lo = int(math.floor(pos))
        hi = min(n - 1, lo + 1)
        frac = pos - lo
        out.append((1.0 - frac) * series[lo] + frac * series[hi])
    return out


# ============================================================================
# 1. Frozen Analysis Phase: Session (base/region) + Harmony Plan + Curves
# ============================================================================

def _continuous_scale_from_co(co_val: float) -> Tuple[str, str, List[int]]:
    """
    CONTINUOUS mapping of CO level [0..1] to modal scale (Lydian -> Phrygian):
      #4->P4 (Ionian) -> M7->b7 (Mixolydian) -> M3->b3 (Dorian) -> M6->b6 (Aeolian) -> M2->b2 (Phrygian).
    """
    scale = [0, 2, 4, 6, 7, 9, 11]
    alterations = [
        (0.16, 3, -1),
        (0.34, 6, -1),
        (0.52, 2, -1),
        (0.70, 5, -1),
        (0.88, 1, -1),
    ]
    num_alt = 0
    for thresh, deg_idx, delta in alterations:
        if co_val >= thresh:
            scale[deg_idx] += delta
            num_alt += 1

    mode_table = {
        0: ("lydian", "Lídio (Luminoso e Espacial)"),
        1: ("ionian", "Jônio / Maior Suave (Sereno e Solar)"),
        2: ("mixolydian", "Mixolídio (Aberto e Flutuante)"),
        3: ("dorian", "Dórico (Contemplativo e Cinematográfico)"),
        4: ("aeolian", "Eólio / Menor (Profundo e Emotivo)"),
        5: ("phrygian", "Frígio (Denso e Introspectivo)"),
    }
    mode_id, mode_name_pt = mode_table[num_alt]
    return mode_id, mode_name_pt, scale


def _voice_lead_chord(
    chord_pcs: List[int],
    prev_voicing: Optional[List[int]],
    low_limit: int = 50,
    high_limit: int = 76,
) -> List[int]:
    """Voice-leading minimizing leaps between consecutive chords."""
    if not prev_voicing:
        base = 48 + chord_pcs[0]
        if base > 57:
            base -= 12
        voicing = [base]
        for pc in chord_pcs[1:]:
            p = base + ((pc - chord_pcs[0]) % 12)
            while p < 55:
                p += 12
            while p > high_limit:
                p -= 12
            if p not in voicing:
                voicing.append(p)
        voicing.sort()
        return voicing

    prev_bass = prev_voicing[0]
    root_pc = chord_pcs[0]
    best_bass = min(
        [b for b in range(45, 60) if (b % 12) == root_pc],
        key=lambda b: abs(b - prev_bass),
    )
    voicing = [best_bass]

    prev_upper = prev_voicing[1:] if len(prev_voicing) > 1 else [prev_bass + 7]
    used = {best_bass}
    for i, pc in enumerate(chord_pcs[1:]):
        target = prev_upper[min(i, len(prev_upper) - 1)]
        cands = [
            p
            for p in range(max(best_bass + 3, low_limit + 5), high_limit + 1)
            if (p % 12) == pc and p not in used
        ]
        if not cands:
            cands = [p for p in range(low_limit, high_limit + 1) if (p % 12) == pc]
        chosen = min(cands, key=lambda p: abs(p - target)) if cands else (best_bass + 7)
        voicing.append(chosen)
        used.add(chosen)

    voicing.sort()
    return voicing


def build_sessions(temp_feat: LayerFeatures, total_bars: int = 8, tuning: str = "region") -> dict:
    """
    Computes the two frozen session sets:
      - `base`: A (pc=9) and 90 BPM (when the temperature conductor eye is off).
      - `region`: key via Circle of Fifths from mean temperature and
        `BPM = clip(round(68 + 40 * idx), 66, 110)`.
    """
    if tuning not in ("base", "region"):
        raise ValueError(f"Parâmetro tuning inválido: {tuning} (use 'base' ou 'region')")

    t_val = float(np.clip(temp_feat.mean_index, 0.0, 1.0))

    base_bpm = int(BASE_SESSION_DEFAULTS["bpm"])
    base_root_pc = int(BASE_SESSION_DEFAULTS["key_root_pc"])
    base_root = str(BASE_SESSION_DEFAULTS["key_root"])
    base_session = {
        "tuning_mode": "base",
        "key_root": base_root,
        "key_root_pc": base_root_pc,
        "key_root_pt": NOTE_NAMES_PT[base_root],
        "bpm": base_bpm,
        "time_signature": "4/4",
        "total_bars": total_bars,
        "duration_seconds": round((total_bars * 4.0 * 60.0) / base_bpm, 3),
        "temperature_mean_index": round(t_val, 4),
    }

    circle_idx = int(round(t_val * 11.0)) % 12
    reg_root_pc = CIRCLE_OF_FIFTHS_SEMITONES[circle_idx]
    reg_root = NOTE_NAMES[reg_root_pc]
    reg_bpm = max(66, min(110, int(round(68.0 + 40.0 * t_val))))
    region_session = {
        "tuning_mode": "region",
        "key_root": reg_root,
        "key_root_pc": reg_root_pc,
        "key_root_pt": NOTE_NAMES_PT[reg_root],
        "bpm": reg_bpm,
        "time_signature": "4/4",
        "total_bars": total_bars,
        "duration_seconds": round((total_bars * 4.0 * 60.0) / reg_bpm, 3),
        "temperature_mean_index": round(t_val, 4),
    }

    active_session = dict(region_session if tuning == "region" else base_session)
    return {
        "tuning_selected": tuning,
        "base": base_session,
        "region": region_session,
        "active": active_session,
    }


def build_harmony_plan(
    co_feat: LayerFeatures,
    active_session: dict,
    total_bars: int = 8,
) -> dict:
    """
    Builds and freezes `harmony_plan` (1 chord per bar) derived EXCLUSIVELY from CO
    and anchored to the active `session` key (without any cross-modulation from temperature or global flow).
    """
    windows = co_feat.scan_windows
    if not windows:
        windows = [
            {
                "window_idx": i,
                "x_center": (i + 0.5) / total_bars,
                "mean": co_feat.mean_index,
                "peak": co_feat.peak_index,
                "contrast": co_feat.spatial_contrast,
                "temporal_var": co_feat.temporal_variation,
                "x_norm": 0.5,
                "y_norm": 0.5,
            }
            for i in range(total_bars)
        ]

    bar_windows: List[dict] = []
    if len(windows) >= total_bars * 2:
        for b in range(total_bars):
            w0, w1 = windows[b * 2], windows[b * 2 + 1]
            bar_windows.append(
                {
                    "window_idx": b,
                    "x_center": 0.5 * (float(w0["x_center"]) + float(w1["x_center"])),
                    "mean": 0.5 * (float(w0["mean"]) + float(w1["mean"])),
                    "peak": max(float(w0["peak"]), float(w1["peak"])),
                    "contrast": 0.5 * (float(w0["contrast"]) + float(w1["contrast"])),
                    "temporal_var": 0.5 * (float(w0["temporal_var"]) + float(w1["temporal_var"])),
                    "x_norm": 0.5 * (float(w0["x_norm"]) + float(w1["x_norm"])),
                    "y_norm": 0.5 * (float(w0["y_norm"]) + float(w1["y_norm"])),
                }
            )
    else:
        bar_windows = windows[:total_bars]

    root_pc = int(active_session["key_root_pc"])
    root_name = NOTE_NAMES[root_pc]
    root_pt = NOTE_NAMES_PT[root_name]

    dom_mode_id, dom_mode_pt, base_scale_iv = _continuous_scale_from_co(co_feat.mean_index)

    step_beats = 4.0
    chords: List[ChordSection] = []
    prev_voicing: Optional[List[int]] = None
    prev_deg: int = -1

    for bar_idx, win in enumerate(bar_windows):
        co_w = float(win["mean"])
        local_mode_id, _, _ = _continuous_scale_from_co(co_w)

        if bar_idx == 0:
            deg_step = 0
            func_pt = "Repouso (Tônica Inicial)"
        elif bar_idx == len(bar_windows) - 1:
            deg_step = 0
            func_pt = "Resolução Cadencial (Tônica)"
        elif bar_idx == max(1, len(bar_windows) // 2 - 1):
            deg_step = 4 if co_w >= 0.45 else 3
            func_pt = "Meia-Cadência (Suspensão)"
        else:
            rel_co = max(0.0, min(1.0, co_w))
            if rel_co < 0.32:
                candidates = [5, 0, 2]
                func_pt = "Repouso"
            elif rel_co < 0.65:
                candidates = [3, 1, 5]
                func_pt = "Subdominante"
            else:
                candidates = [4, 3, 6]
                func_pt = "Tensão"
            deg_step = candidates[0] if candidates[0] != prev_deg else candidates[1]

        prev_deg = deg_step
        chord_root_pc = (root_pc + base_scale_iv[deg_step]) % 12

        third_iv = (base_scale_iv[(deg_step + 2) % 7] - base_scale_iv[deg_step]) % 12
        fifth_iv = (base_scale_iv[(deg_step + 4) % 7] - base_scale_iv[deg_step]) % 12
        seventh_iv = (base_scale_iv[(deg_step + 6) % 7] - base_scale_iv[deg_step]) % 12
        ninth_iv = ((base_scale_iv[(deg_step + 1) % 7] - base_scale_iv[deg_step]) % 12) + 12

        richness_w = 0.55 * float(win["contrast"]) + 0.45 * float(win["temporal_var"])
        if richness_w < 0.12:
            max_voices = 3
            suffix = "m" if third_iv == 3 else ("dim" if fifth_iv == 6 else "")
            intervals = [0, third_iv, fifth_iv]
        elif richness_w < 0.30:
            max_voices = 4
            if third_iv == 3:
                suffix = "m7"
            elif seventh_iv == 11:
                suffix = "maj7"
            else:
                suffix = "7"
            intervals = [0, third_iv, fifth_iv, seventh_iv]
        else:
            max_voices = 5
            if third_iv == 3:
                suffix = "m9"
            elif seventh_iv == 11:
                suffix = "maj9"
            else:
                suffix = "9"
            intervals = [0, third_iv, fifth_iv, seventh_iv, ninth_iv]

        chord_symbol = f"{NOTE_NAMES[chord_root_pc]}{suffix}"
        chord_pcs = [(chord_root_pc + iv) % 12 for iv in intervals[:max_voices]]
        midi_voicing = _voice_lead_chord(chord_pcs, prev_voicing)
        prev_voicing = midi_voicing

        scale_pcs = [(root_pc + iv) % 12 for iv in base_scale_iv]
        start_b = round(bar_idx * step_beats, 4)

        chords.append(
            ChordSection(
                bar=bar_idx,
                symbol=chord_symbol,
                degree_label=f"C{bar_idx + 1}",
                function_pt=func_pt,
                start_beat=start_b,
                duration_beats=step_beats,
                root_pc=chord_root_pc,
                third_pc=(chord_root_pc + third_iv) % 12,
                fifth_pc=(chord_root_pc + fifth_iv) % 12,
                midi_notes=midi_voicing,
                note_names=[midi_to_name(m) for m in midi_voicing],
                source_x=round(float(win["x_norm"]), 4),
                source_y=round(float(win["y_norm"]), 4),
                co_local=round(co_w, 4),
                mode_id=local_mode_id,
                scale_pcs=scale_pcs,
            )
        )

    return {
        "key_root": root_name,
        "key_root_pc": root_pc,
        "key_root_pt": root_pt,
        "mode_id": dom_mode_id,
        "mode_name_pt": dom_mode_pt,
        "scale_pitch_classes": [(root_pc + iv) % 12 for iv in base_scale_iv],
        "chord_progression": [c.symbol for c in chords],
        "voicing_style": f"voice-leading suave ({len(chords)} compassos, 3 a 5 vozes)",
        "chords": [asdict(c) for c in chords],
    }


def build_wind_bus_plan(wind_feat: LayerFeatures, active_session: dict, total_bars: int = 8) -> Tuple[dict, dict]:
    """
    Builds the parameters and continuous curves for the Wind Effects Bus, derived
    EXCLUSIVELY from the wind video (no self-generated noise).
    """
    slots = total_bars * 8
    w_mean = float(np.clip(wind_feat.mean_index, 0.0, 1.0))
    w_orient = float(np.clip(wind_feat.wind_orientation, -1.0, 1.0))
    w_contrast = float(np.clip(wind_feat.wind_local_contrast, 0.0, 1.0))
    w_turb = float(
        np.clip(
            0.50 * wind_feat.wind_turbulence
            + 0.30 * wind_feat.temporal_variation
            + 0.20 * wind_feat.motion_mean,
            0.0,
            1.0,
        )
    )

    speed_curve = [round(float(np.clip(v, 0.0, 1.0)), 4) for v in resample_curve(wind_feat.time_series, slots, w_mean)]
    contrast_curve = [
        round(float(np.clip(v, 0.0, 1.0)), 4)
        for v in resample_curve(wind_feat.wind_contrast_series, slots, w_contrast)
    ]
    orient_curve = [
        round(float(np.clip(v, -1.0, 1.0)), 4)
        for v in resample_curve(wind_feat.wind_orientation_series, slots, w_orient)
    ]
    raw_turb_s = resample_curve(wind_feat.wind_turbulence_series, slots, w_turb)
    mot_s = resample_curve(wind_feat.motion_series, slots, wind_feat.motion_mean)
    turb_curve = [
        round(float(np.clip(0.70 * rt + 0.30 * rm, 0.0, 1.0)), 4)
        for rt, rm in zip(raw_turb_s, mot_s)
    ]

    reverb_decay_sec = round(1.20 + 3.10 * w_mean, 2)
    reverb_wet = round(min(0.68, 0.16 + 0.48 * w_mean), 3)
    delay_mix = round(min(0.42, 0.06 + 0.28 * w_mean), 3)
    delay_feedback = round(min(0.64, 0.18 + 0.44 * w_turb), 3)
    chorus_depth = round(min(0.78, 0.10 + 0.58 * w_turb), 3)

    if w_mean < 0.22:
        space_pt = "Ambiência Íntima e Cristalina (Ventos Calmos)"
    elif w_mean < 0.50:
        space_pt = "Espaço Estéreo Aberto com Deriva Suave (Brisas Regionais)"
    else:
        space_pt = "Imersão Espacial Ampla (Correntes Oceânicas/Ciclônicas Intensas)"

    wind_params = {
        "role": "effect_bus",
        "space_profile_pt": space_pt,
        "mean_speed": round(w_mean, 4),
        "mean_contrast": round(w_contrast, 4),
        "mean_orientation": round(w_orient, 4),
        "mean_turbulence": round(w_turb, 4),
        "optical_flow_mean": round(wind_feat.motion_mean, 4),
        "reverb_decay_seconds": reverb_decay_sec,
        "reverb_wet_mix": reverb_wet,
        "pingpong_delay_mix": delay_mix,
        "pingpong_delay_feedback": delay_feedback,
        "dotted_eighth_delay_seconds": round(0.75 * (60.0 / float(active_session["bpm"])), 4),
        "chorus_modulation_depth": chorus_depth,
        "speed_curve": speed_curve,
        "contrast_curve": contrast_curve,
        "orientation_curve": orient_curve,
        "turbulence_curve": turb_curve,
    }

    explanation = {
        "layer_id": "wind",
        "role": "effect",
        "layer_name_pt": "Bus de Efeitos (Vento)",
        "source_map": "Vento Próximo à Superfície (NASA GMAO MC02)",
        "video_file": wind_feat.video_file,
        "extracted_metrics": {
            "wind_speed_mean": round(w_mean, 3),
            "wind_local_contrast": round(w_contrast, 3),
            "wind_orientation": round(w_orient, 3),
            "wind_turbulence": round(w_turb, 3),
            "wind_optical_flow": round(wind_feat.motion_mean, 3),
        },
        "musical_decisions": {
            "perfil_espacial": space_pt,
            "reverb_convolucao": f"{reverb_wet:.0%} ({reverb_decay_sec}s + shimmer linear)",
            "delay_colcheia_pontuada": f"mix {delay_mix:.0%} | feedback {delay_feedback:.0%}",
            "chorus_e_autopan": f"chorus {chorus_depth:.2f} | pan bias {w_orient:+.2f}",
        },
        "rule_applied": (
            "Bus de efeitos estritamente linear sem som próprio aplicado à soma dos instrumentos ligados: "
            "velocidade controla decay/wet do reverb, contraste controla filtro ressonante, direção controla "
            "auto-pan e turbulência controla chorus e feedback do delay em colcheia pontuada."
        ),
        "ui_summary_pt": (
            f"O bus de vento ({w_mean:.0%}) aplica {space_pt.lower()} sobre a soma dos instrumentos ativos "
            f"(reverb {reverb_decay_sec}s, delay feedback {delay_feedback:.0%})."
        ),
    }
    return wind_params, explanation


def _build_melody_scan_cursors(total_bars: int, bpm: float, lightning_map: str) -> List[dict]:
    """
    Exposes the per-bar melody scan cursor trajectory to sync with the map
    in the video and write to `manifest.json`.
    """
    beat_sec = 60.0 / max(1.0, float(bpm))
    cursors: List[dict] = []
    for b in range(total_bars):
        sb = round(b * 4.0, 4)
        eb = round((b + 1) * 4.0, 4)
        slot_centers = [round((s + 0.5) / 8.0, 4) for s in range(8)]
        cursors.append(
            {
                "bar": b + 1,
                "mapping_mode": lightning_map,
                "start_beat": sb,
                "end_beat": eb,
                "start_sec": round(sb * beat_sec, 4),
                "end_sec": round(eb * beat_sec, 4),
                "cursor_x_start": 0.0 if lightning_map == "scan" else None,
                "cursor_x_end": 1.0 if lightning_map == "scan" else None,
                "pan_start": -0.75 if lightning_map == "scan" else None,
                "pan_end": 0.75 if lightning_map == "scan" else None,
                "eighth_slot_x_centers": slot_centers if lightning_map == "scan" else None,
            }
        )
    return cursors


def build_control_plan(
    bbox: GeoBoundingBox,
    features: Dict[str, LayerFeatures],
    total_bars: int = 8,
    tuning: str = "region",
    lightning_map: str = "scan",
) -> dict:
    """
    Frozen Phase 1: builds `session` (`base` and `region`), `harmony_plan`,
    `wind_bus_plan`, and isolated per-layer curves. Never depends on which instruments are enabled.
    """
    sessions = build_sessions(features["temperature"], total_bars=total_bars, tuning=tuning)
    active_session = sessions["active"]

    harmony_plan = build_harmony_plan(
        co_feat=features["chords"],
        active_session=active_session,
        total_bars=total_bars,
    )
    wind_plan, wind_explanation = build_wind_bus_plan(
        wind_feat=features["wind"],
        active_session=active_session,
        total_bars=total_bars,
    )
    melody_cursors = _build_melody_scan_cursors(
        total_bars=total_bars,
        bpm=float(active_session["bpm"]),
        lightning_map=lightning_map,
    )

    temp_feat = features["temperature"]
    temp_explanation = {
        "layer_id": "temperature",
        "role": "conductor",
        "layer_name_pt": "Regente da Sessão (Temperatura)",
        "source_map": "Temperatura Próxima à Superfície (NASA GMAO MC01)",
        "video_file": temp_feat.video_file,
        "extracted_metrics": {
            "temperature_mean_index": round(temp_feat.mean_index, 3),
            "thermal_spatial_contrast": round(temp_feat.spatial_contrast, 3),
            "thermal_optical_flow": round(temp_feat.motion_mean, 3),
        },
        "musical_decisions": {
            "tuning_ativo": tuning,
            "tom_sessao": f"{active_session['key_root_pt']} ({active_session['key_root']})",
            "bpm_sessao": active_session["bpm"],
            "sessao_base": f"{sessions['base']['key_root']} @ {sessions['base']['bpm']} BPM",
            "sessao_region": f"{sessions['region']['key_root']} @ {sessions['region']['bpm']} BPM",
        },
        "rule_applied": (
            "Regente sem som próprio: quando --tuning=region, a temperatura média define o Tom no Círculo "
            "das Quintas e BPM = round(68 + 40 * índice) [66..110]; quando --tuning=base, usa Lá (A) e 90 BPM."
        ),
        "ui_summary_pt": (
            f"Regente Temperatura ({temp_feat.mean_index:.0%}, modo {tuning}): sessão em "
            f"{active_session['key_root_pt']} ({active_session['key_root']}) a {active_session['bpm']} BPM."
        ),
    }

    control_curves = {
        "chords": {
            "co_series": features["chords"].time_series,
            "optical_flow_series": features["chords"].motion_series,
        },
        "bass": {
            "no2_series": features["bass"].time_series,
            "optical_flow_series": features["bass"].motion_series,
            "bar_column_profiles": features["bass"].bar_column_profiles,
        },
        "melody": {
            "lightning_series": features["melody"].time_series,
            "optical_flow_series": features["melody"].motion_series,
            "persistence_hotspots": features["melody"].persistence_hotspots,
            "scan_cursors": melody_cursors,
        },
        "temperature": {
            "temperature_series": temp_feat.time_series,
            "optical_flow_series": temp_feat.motion_series,
        },
        "wind": {
            "speed_curve": wind_plan["speed_curve"],
            "contrast_curve": wind_plan["contrast_curve"],
            "orientation_curve": wind_plan["orientation_curve"],
            "turbulence_curve": wind_plan["turbulence_curve"],
        },
    }

    return {
        "bbox": {
            "name": bbox.name,
            "description": bbox.description,
            "lat_min": bbox.lat_min,
            "lat_max": bbox.lat_max,
            "lon_min": bbox.lon_min,
            "lon_max": bbox.lon_max,
            "center_lat": round(bbox.center_lat, 3),
            "center_lon": round(bbox.center_lon, 3),
        },
        "session": sessions,
        "harmony_plan": harmony_plan,
        "wind_plan": wind_plan,
        "melody_scan_cursors": melody_cursors,
        "control_curves": control_curves,
        "conductor_explanation": temp_explanation,
        "wind_explanation": wind_explanation,
    }


# ============================================================================
# 2. Instrument 1: CHORDS (CO) — Anchored to Session + Own Optical Flow
# ============================================================================

def compose_chords_instrument(
    co_feat: LayerFeatures,
    control_plan: dict,
) -> Tuple[dict, List[NoteEvent], dict]:
    harmony_plan = control_plan["harmony_plan"]
    chords_dicts = harmony_plan["chords"]
    total_bars = len(chords_dicts)

    co_motion_bars = resample_curve(co_feat.motion_series, total_bars, co_feat.motion_mean)

    pad_notes: List[NoteEvent] = []
    for b_idx, ch in enumerate(chords_dicts):
        local_co = float(ch.get("co_local", co_feat.mean_index))
        local_mot = float(co_motion_bars[b_idx])
        vel_base = 0.48 + 0.22 * local_co + 0.12 * local_mot
        bright = float(np.clip(0.30 + 0.42 * (1.0 - 0.5 * local_co) + 0.26 * local_mot, 0.18, 0.95))

        for v_idx, mp in enumerate(ch["midi_notes"]):
            pad_notes.append(
                NoteEvent(
                    pitch=int(mp),
                    note_name=midi_to_name(int(mp)),
                    start_beat=float(ch["start_beat"]),
                    duration_beats=max(0.4, round(float(ch["duration_beats"]) - 0.08, 3)),
                    velocity=round(min(0.86, vel_base - 0.03 * v_idx), 3),
                    layer="chords",
                    bar=b_idx,
                    source_x=float(ch["source_x"]),
                    source_y=float(ch["source_y"]),
                    source_intensity=round(local_co, 4),
                    brightness=round(bright, 3),
                )
            )

    prog_str = " → ".join(harmony_plan["chord_progression"][:8])
    chords_params = {
        "role": "instrument",
        "stem_file": "chords.wav",
        "fixed_gain": STEM_GAINS["chords"],
        "key_root": harmony_plan["key_root"],
        "key_root_pt": harmony_plan["key_root_pt"],
        "mode_id": harmony_plan["mode_id"],
        "mode_name_pt": harmony_plan["mode_name_pt"],
        "chord_progression": harmony_plan["chord_progression"],
        "voicing_style": harmony_plan["voicing_style"],
        "optical_flow_mean": round(co_feat.motion_mean, 4),
        "note_count": len(pad_notes),
    }

    explanation = {
        "layer_id": "chords",
        "role": "instrument",
        "layer_name_pt": "Instrumento: Acordes (CO)",
        "source_map": "Monóxido de Carbono — CO (NASA GMAO MC03)",
        "video_file": co_feat.video_file,
        "extracted_metrics": {
            "co_mean_index": round(co_feat.mean_index, 3),
            "co_spatial_contrast": round(co_feat.spatial_contrast, 3),
            "co_temporal_variation": round(co_feat.temporal_variation, 3),
            "co_optical_flow": round(co_feat.motion_mean, 3),
        },
        "musical_decisions": {
            "tonalidade_ancorada": f"{harmony_plan['key_root_pt']} ({harmony_plan['key_root']})",
            "modo_continuo": harmony_plan["mode_name_pt"],
            "progressao_acordes": prog_str,
            "vozes_e_conducao": harmony_plan["voicing_style"],
        },
        "rule_applied": (
            "1 acorde por compasso ancorado no tom da session: o CO define o modo contínuo (Lídio->Frígio), "
            "a função harmônica (Repouso->Subdominante->Tensão->Resolução) e o número de vozes (3–5) com "
            "voice-leading suave e fluxo óptico próprio."
        ),
        "ui_summary_pt": (
            f"O mapa de CO ({co_feat.mean_index:.0%}) gerou a progressão {prog_str} em "
            f"{harmony_plan['key_root_pt']} {harmony_plan['mode_name_pt'].split(' (')[0]}."
        ),
    }
    return chords_params, pad_notes, explanation


# ============================================================================
# 3. Instrument 2: BASS (NO2) — Continuous Musical Line Built from Image
# ============================================================================

def compose_bass_instrument(
    no2_feat: LayerFeatures,
    control_plan: dict,
    bass_follows_harmony: bool = True,
) -> Tuple[dict, List[NoteEvent], dict]:
    """
    Builds a bass line that is 100% harmonic and 100% driven by the NO2 image (8 columns/bar):
      - Harmonic rail:
          * `bass_follows_harmony=True`: strictly uses chord tones (`root`, `3rd`, `5th`) on strong
            beats/sustained notes and the bar's exact scale (`scale_pcs` from `harmony_plan`) on
            passing eighth-notes, with chromatic approach allowed only on the last short eighth (`col 7`).
          * `bass_follows_harmony=False`: anchors only on tonic/fifth and neutral pentatonic of `session`,
            with no dependency on CO.
      - 100% NO2 image-driven decisions:
          * Local density and contrast determine the bar's note budget (1 sustained note over
            clean ocean up to articulated syncopated lines of 5–6 notes in megacities, no fixed machine-gun).
          * Plume latitude (`1 - y_norm`) and horizontal gradient (`grad_x`) drive voice-leading
            (rising when the plume grows/moves north and descending smoothly to the root when dissipating).
          * Continuous per-note cutoff (120–560 Hz), drive (0.04–0.48), and attack (8–48 ms).
    """
    active_session = control_plan["session"]["active"]
    chords_list = control_plan["harmony_plan"]["chords"]
    total_bars = int(active_session["total_bars"])
    session_root_pc = int(active_session["key_root_pc"]) % 12

    bar_profiles = no2_feat.bar_column_profiles
    no2_motion_bars = resample_curve(no2_feat.motion_series, total_bars, no2_feat.motion_mean)

    def _bass_root_midi(pc: int) -> int:
        m = 36 + (pc % 12)
        if m > 46:
            m -= 12
        return m

    def _pitches_in_range(pcs: set[int], lo: int = 35, hi: int = 53) -> List[int]:
        out = [m for m in range(lo, hi + 1) if (m % 12) in pcs]
        return out if out else [36 + (min(pcs) % 12)]

    bass_notes: List[NoteEvent] = []
    cutoffs: List[float] = []
    drives: List[float] = []
    attacks: List[float] = []

    prev_pitch: Optional[int] = None
    prev_bar_root_pc: Optional[int] = None

    for b_idx in range(total_bars):
        if bass_follows_harmony and b_idx < len(chords_list):
            ch_cur = chords_list[b_idx]
            cur_root_pc = int(ch_cur["root_pc"]) % 12
            cur_third_pc = int(ch_cur["third_pc"]) % 12
            cur_fifth_pc = int(ch_cur["fifth_pc"]) % 12
            raw_scale = ch_cur.get("scale_pcs") or [cur_root_pc, cur_third_pc, cur_fifth_pc]
            scale_pc_set = {int(p) % 12 for p in raw_scale} | {cur_root_pc, cur_third_pc, cur_fifth_pc}
            nxt_root_pc = int(chords_list[(b_idx + 1) % len(chords_list)]["root_pc"]) % 12
        else:
            cur_root_pc = session_root_pc
            cur_fifth_pc = (session_root_pc + 7) % 12
            cur_third_pc = cur_fifth_pc
            scale_pc_set = {(session_root_pc + iv) % 12 for iv in (0, 2, 5, 7, 10)}
            nxt_root_pc = session_root_pc

        root_m = _bass_root_midi(cur_root_pc)
        next_root_m = _bass_root_midi(nxt_root_pc)

        pillar_pitches = _pitches_in_range({cur_root_pc, cur_fifth_pc}, 35, 52)
        chord_pitches = sorted(
            set(pillar_pitches) | set(_pitches_in_range({cur_third_pc}, 39, 53))
        )
        scale_pitches = _pitches_in_range(scale_pc_set, 35, 53)

        cols = (
            bar_profiles[b_idx]
            if b_idx < len(bar_profiles) and len(bar_profiles[b_idx]) == 8
            else [
                {
                    "col": c,
                    "x_norm": (c + 0.5) / 8.0,
                    "y_norm": 0.5,
                    "mean": no2_feat.mean_index,
                    "peak": no2_feat.peak_index,
                    "contrast": no2_feat.spatial_contrast,
                    "grad_x": 0.0,
                }
                for c in range(8)
            ]
        )
        mot_b = float(no2_motion_bars[b_idx])

        # Continuous energy and salience of each of the 8 NO2 image columns
        col_energy = [
            float(np.clip(0.58 * float(c["mean"]) + 0.42 * float(c["peak"]), 0.0, 1.0))
            for c in cols
        ]
        bar_mean = float(np.mean(col_energy))
        bar_peak = float(np.max(col_energy))
        bar_contrast = float(np.mean([float(c["contrast"]) for c in cols]))
        bar_col_std = float(np.clip(np.std(col_energy) * 3.2, 0.0, 1.0))

        # Note budget derived continuously from image density/contrast (1 over ocean to 6 in megacities)
        activity_idx = float(
            np.clip(
                0.54 * bar_mean
                + 0.24 * bar_peak
                + 0.14 * max(bar_contrast, bar_col_std)
                + 0.08 * mot_b,
                0.0,
                1.0,
            )
        )
        target_hits = int(np.clip(round(1.0 + 5.2 * (activity_idx ** 1.15)), 1, 6))

        col_salience: List[float] = [1.0]
        for c_i in range(1, 8):
            rise = max(0.0, col_energy[c_i] - col_energy[c_i - 1])
            local_prom = max(
                0.0, col_energy[c_i] - 0.5 * (col_energy[c_i - 1] + col_energy[(c_i + 1) % 8])
            )
            metric_w = 0.12 if c_i == 4 else (0.05 if c_i in (2, 6) else 0.02)
            sal = (
                0.44 * col_energy[c_i]
                + 0.30 * rise
                + 0.16 * local_prom
                + 0.10 * float(cols[c_i]["contrast"])
                + metric_w * col_energy[c_i]
            )
            col_salience.append(float(np.clip(sal, 0.0, 1.0)))

        # Deterministically select the most salient columns of the NO2 plume
        picked_slots: List[int] = [0]
        while len(picked_slots) < target_hits:
            best_c = -1
            best_score = -1.0
            for c_i in range(1, 8):
                if c_i in picked_slots:
                    continue
                adj_count = sum(1 for p in picked_slots if abs(p - c_i) == 1)
                adj_pen = (0.08 * adj_count) if target_hits <= 4 else (0.03 * adj_count)
                eff_s = col_salience[c_i] - adj_pen
                if eff_s >= 0.16 and eff_s > best_score:
                    best_score = eff_s
                    best_c = c_i
            if best_c < 0:
                break
            picked_slots.append(best_c)

        active_slots = sorted(picked_slots)

        for idx_in_bar, c_slot in enumerate(active_slots):
            next_slot = active_slots[idx_in_bar + 1] if (idx_in_bar + 1) < len(active_slots) else 8
            span_eighths = next_slot - c_slot
            raw_dur_beats = span_eighths * 0.5

            e_now = col_energy[c_slot]
            if len(active_slots) == 1:
                gate_ratio = 0.97  # Clean air / ocean: root sustained for the entire bar
            elif c_slot + 1 < next_slot and col_energy[c_slot + 1] < 0.52 * e_now and e_now > 0.18:
                gate_ratio = 0.72  # Musical breathing room when the NO2 plume drops
            else:
                gate_ratio = float(np.clip(0.94 - 0.12 * float(cols[c_slot]["contrast"]), 0.78, 0.95))

            dur_beats = max(0.28, round(raw_dur_beats * gate_ratio, 3))
            start_beat = round(b_idx * 4.0 + c_slot * 0.5, 4)

            north_y = float(np.clip(1.0 - float(cols[c_slot]["y_norm"]), 0.0, 1.0))
            grad_x = float(cols[c_slot]["grad_x"])
            is_short_pickup = (
                c_slot == 7
                and idx_in_bar == len(active_slots) - 1
                and raw_dur_beats <= 0.5
                and e_now >= 0.24
            )

            if c_slot == 0:
                # Beat 1: anchor on root (or soft 5th only if chord repeats and plume is to the north)
                if (
                    prev_bar_root_pc == cur_root_pc
                    and prev_pitch is not None
                    and len(active_slots) >= 2
                    and north_y > 0.68
                    and e_now >= 0.45
                ):
                    pitch = min(pillar_pitches, key=lambda p: abs(p - (root_m + 7)))
                else:
                    pitch = root_m
            elif is_short_pickup:
                # Last short eighth (slot 7): diatonic passing tone (or urban semitone) leading to next_root_m
                ref_prev = prev_pitch if prev_pitch is not None else root_m
                diatonic_steps = [
                    p for p in scale_pitches if p != next_root_m and 1 <= abs(p - next_root_m) <= 2
                ]
                if diatonic_steps and e_now < 0.62:
                    pitch = min(
                        diatonic_steps,
                        key=lambda p: abs(p - next_root_m) + 0.35 * abs(p - ref_prev),
                    )
                elif e_now >= 0.62:
                    pitch = (next_root_m - 1) if ref_prev <= next_root_m else (next_root_m + 1)
                    pitch = int(np.clip(pitch, 35, 53))
                else:
                    pitch = min(pillar_pitches, key=lambda p: abs(p - ref_prev))
            else:
                # Voice-leading driven by latitude (1 - y_norm), local intensity, and grad_x slope
                ref_prev = prev_pitch if prev_pitch is not None else root_m
                slope_norm = 0.5 + 0.5 * float(np.clip(grad_x * 4.5, -1.0, 1.0))
                img_contour = float(np.clip(0.48 * north_y + 0.37 * e_now + 0.15 * slope_norm, 0.0, 1.0))
                contour_target = root_m + img_contour * 11.0
                step_bias = float(np.clip(grad_x * 18.0, -3.5, 3.5))
                target_m = 0.62 * contour_target + 0.38 * (ref_prev + step_bias)

                # Long notes or beat 3 use only pure chord tones; short eighths can walk along the scale
                if raw_dur_beats >= 1.5:
                    pool = pillar_pitches
                elif raw_dur_beats >= 1.0 or c_slot == 4:
                    pool = chord_pitches
                else:
                    pool = scale_pitches

                def _cand_cost(cand: int) -> float:
                    cost = abs(cand - target_m) + 0.32 * abs(cand - ref_prev)
                    if cand == ref_prev and abs(grad_x) > 0.035 and len(pool) > 1:
                        cost += 1.6
                    if grad_x > 0.03 and cand < ref_prev:
                        cost += 1.2
                    elif grad_x < -0.03 and cand > ref_prev:
                        cost += 1.2
                    return cost

                pitch = min(pool, key=_cand_cost)

            prev_pitch = int(pitch)

            eff_no2 = float(np.clip(0.75 * e_now + 0.15 * float(cols[c_slot]["contrast"]) + 0.10 * mot_b, 0.0, 1.0))
            cutoff_hz = round(float(np.clip(120.0 + 440.0 * eff_no2, 120.0, 560.0)), 1)
            drive = round(float(np.clip(0.04 + 0.44 * eff_no2, 0.04, 0.48)), 3)
            attack_sec = round(float(np.clip(0.048 - 0.040 * eff_no2, 0.008, 0.048)), 4)

            if c_slot == 0:
                accent = 1.0
            elif c_slot == 4:
                accent = 0.94
            elif (c_slot % 2) == 1 and e_now > 0.32:
                accent = 0.90
            else:
                accent = 0.84
            vel = round(float(np.clip((0.56 + 0.30 * eff_no2) * accent, 0.42, 0.90)), 3)

            cutoffs.append(cutoff_hz)
            drives.append(drive)
            attacks.append(attack_sec)

            bass_notes.append(
                NoteEvent(
                    pitch=int(pitch),
                    note_name=midi_to_name(int(pitch)),
                    start_beat=start_beat,
                    duration_beats=dur_beats,
                    velocity=vel,
                    layer="bass",
                    bar=b_idx,
                    source_x=float(cols[c_slot]["x_norm"]),
                    source_y=float(cols[c_slot]["y_norm"]),
                    source_intensity=round(e_now, 4),
                    cutoff_hz=cutoff_hz,
                    drive=drive,
                    attack_sec=attack_sec,
                )
            )

        prev_bar_root_pc = cur_root_pc

    mean_cutoff = round(float(np.mean(cutoffs)) if cutoffs else 160.0, 1)
    mean_drive = round(float(np.mean(drives)) if drives else 0.08, 3)
    mean_attack = round(float(np.mean(attacks)) if attacks else 0.035, 4)

    bass_params = {
        "role": "instrument",
        "stem_file": "bass.wav",
        "fixed_gain": STEM_GAINS["bass"],
        "follows_harmony_plan": bool(bass_follows_harmony),
        "style_name_pt": (
            f"Baixo Harmônico NO₂ ({'Segue Harmony Plan' if bass_follows_harmony else 'Tônica da Session'} | "
            f"Filtro médio {mean_cutoff:.0f} Hz)"
        ),
        "lowpass_cutoff_hz": mean_cutoff,
        "mean_cutoff_hz": mean_cutoff,
        "harmonic_drive": mean_drive,
        "mean_drive": mean_drive,
        "mean_attack_seconds": mean_attack,
        "optical_flow_mean": round(no2_feat.motion_mean, 4),
        "note_count": len(bass_notes),
        "notes_per_bar": round(len(bass_notes) / max(1, total_bars), 2),
    }

    explanation = {
        "layer_id": "bass",
        "role": "instrument",
        "layer_name_pt": "Instrumento: Baixo (NO₂)",
        "source_map": "Dióxido de Nitrogênio — NO₂ (NASA GMAO MC04)",
        "video_file": no2_feat.video_file,
        "extracted_metrics": {
            "no2_mean_index": round(no2_feat.mean_index, 3),
            "no2_peak_index": round(no2_feat.peak_index, 3),
            "no2_spatial_contrast": round(no2_feat.spatial_contrast, 3),
            "no2_optical_flow": round(no2_feat.motion_mean, 3),
        },
        "musical_decisions": {
            "vinculo_harmonico": "trilho harmônico do CO (tons do acorde + escala)" if bass_follows_harmony else "tônica/quinta da session",
            "ataques_totais": len(bass_notes),
            "cutoff_medio_hz": mean_cutoff,
            "drive_medio": mean_drive,
        },
        "rule_applied": (
            "Trilho harmônico estrito do harmony_plan combinado com decisão 100% guiada pela varredura "
            "de 8 colunas do NO₂: densidade/contraste definem os ataques, latitude (1-Y) + gradiente X "
            "conduzem o voice-leading por tons do acorde e graus da escala, e o nível local controla "
            "cutoff (120–560 Hz), drive nos harmônicos superiores (0.04–0.48) e ataque."
        ),
        "ui_summary_pt": (
            f"O mapa de NO₂ ({no2_feat.mean_index:.0%}) construiu {len(bass_notes)} notas de baixo harmônico "
            f"(filtro médio {mean_cutoff:.0f} Hz, drive {mean_drive:.2f})."
        ),
    }
    return bass_params, bass_notes, explanation


# ============================================================================
# 4. Instrument 3: MELODY (Lightning) — Full Redesign w/ Memory and Scan
# ============================================================================

@dataclass
class _BarFlashCluster:
    slot: int
    beat_offset: float
    primary: LightningEvent
    members: List[LightningEvent]
    is_anchor: bool


def _build_neutral_pentatonic_pool(key_root_pc: int) -> List[int]:
    """
    Builds ~2 octaves (11 consecutive degrees: 2 octaves + high tonic) of the neutral
    suspended pentatonic [0, 2, 5, 7, 10] anchored at `key_root_pc`, in the Celesta/Rhodes register.
    """
    base_root = 60 + (key_root_pc % 12)
    if base_root > 66:
        base_root -= 12  # Keeps base between G3 (55) and F#4 (66) -> 2 octaves up to ~G5..F#6
    pool: List[int] = []
    for oct_idx in range(2):
        for iv in NEUTRAL_SUSPENDED_PENTATONIC_IV:
            pool.append(base_root + oct_idx * 12 + iv)
    pool.append(base_root + 24)
    return pool


def compose_melody_instrument(
    light_feat: LayerFeatures,
    control_plan: dict,
    lightning_map: str = "scan",
    lightning_mode: str = "strum",
    lightning_pitch_range: str = "fixed",
    min_target_notes_per_bar: int = 2,
    max_notes_per_bar: int = 8,
) -> Tuple[dict, List[NoteEvent], List[NoteEvent], dict]:
    """
    100% independent melody derived from ISS lightning:
      - Neutral suspended pentatonic scale (1, 2, 4, 5, b7) anchored only to the `session` key
        (DOES NOT depend on CO mode or chords).
      - `--lightning-map scan`: divides the video into N bars by event frame and scans
        left->right within each bar (X -> eighth-note 0..7 and pan).
      - `--lightning-map time`: places the note on the chronological eighth-note when the flash occurred.
      - Y pitch (north = high) across ~2 octaves (`fixed` = absolute latitude in crop; `auto` =
        fitted to actual event distribution), octave-folding leaps > 4 degrees without changing pitch class.
      - Annual memory: persistent regions become anchor notes on strong beats, with more weight and duration.
      - Adaptive density strictly respecting the `max_notes_per_bar` cap (default 8).
    """
    if lightning_map not in ("scan", "time"):
        raise ValueError(f"Modo inválido para lightning_map: {lightning_map} (use 'scan' ou 'time')")
    if lightning_mode not in ("strum", "harmonic_bloom", "subdivision"):
        raise ValueError(f"Modo inválido para lightning_mode: {lightning_mode}")
    if lightning_pitch_range not in ("fixed", "auto"):
        raise ValueError(f"Modo inválido para lightning_pitch_range: {lightning_pitch_range} (use 'fixed' ou 'auto')")

    active_session = control_plan["session"]["active"]
    total_bars = int(active_session["total_bars"])
    total_beats = total_bars * 4.0
    key_root_pc = int(active_session["key_root_pc"])

    scale_pool = _build_neutral_pentatonic_pool(key_root_pc)
    events = list(light_feat.lightning_events)
    mot_slots = resample_curve(light_feat.motion_series, total_bars * 8, light_feat.motion_mean)

    # No events -> absolute silence (never invent notes)
    if not events:
        melody_params = {
            "role": "instrument",
            "stem_file": "melody.wav",
            "fixed_gain": STEM_GAINS["melody"],
            "lightning_map": lightning_map,
            "lightning_mode": lightning_mode,
            "lightning_pitch_range": lightning_pitch_range,
            "scale_type": "neutral_suspended_pentatonic (1, 2, 4, 5, b7)",
            "scale_pitch_classes": [(key_root_pc + iv) % 12 for iv in NEUTRAL_SUSPENDED_PENTATONIC_IV],
            "max_notes_per_bar": max_notes_per_bar,
            "min_target_notes_per_bar": min_target_notes_per_bar,
            "note_count": 0,
            "sparkle_note_count": 0,
            "bloom_interval_count": 0,
            "crystal_sparkle_count": 0,
            "anchor_note_count": 0,
            "notes_per_bar": 0.0,
            "max_observed_notes_in_bar": 0,
            "optical_flow_mean": round(light_feat.motion_mean, 4),
            "style_name_pt": "Silêncio Celestial (nenhum clarão detectado)",
        }
        explanation = {
            "layer_id": "melody",
            "role": "instrument",
            "layer_name_pt": "Instrumento: Melodia (Raios ISS)",
            "source_map": "Raios e Relâmpagos Anuais vistos da ISS (NASA SOS)",
            "video_file": light_feat.video_file,
            "extracted_metrics": {
                "extracted_events": 0,
                "lightning_mean_index": round(light_feat.mean_index, 3),
                "lightning_optical_flow": round(light_feat.motion_mean, 3),
            },
            "musical_decisions": {
                "notas_geradas": 0,
                "notas_sparkle": 0,
                "modo_tempo": lightning_map,
                "modo_densidade": lightning_mode,
            },
            "rule_applied": "Nenhum evento luminoso detectado -> silêncio total na melodia.",
            "ui_summary_pt": "Ausência de clarões no recorte resultou em silêncio total na melodia.",
        }
        return melody_params, [], [], explanation

    # Pitch range (north = 1.0 - y_norm)
    north_vals = [1.0 - ev.y_norm for ev in events]
    if lightning_pitch_range == "auto" and len(north_vals) >= 2:
        n_lo = float(np.percentile(north_vals, 5.0))
        n_hi = float(np.percentile(north_vals, 95.0))
        if (n_hi - n_lo) < 0.06:
            n_lo = max(0.0, n_lo - 0.10)
            n_hi = min(1.0, n_hi + 0.10)
    else:
        n_lo, n_hi = 0.0, 1.0

    def _raw_degree(y_norm: float) -> int:
        north = float(np.clip(((1.0 - y_norm) - n_lo) / max(1e-4, n_hi - n_lo), 0.0, 1.0))
        deg = int(round(north * (len(scale_pool) - 1)))
        return max(0, min(len(scale_pool) - 1, deg))

    def _quantize_pitch_and_degree(y_norm: float, prev_deg: Optional[int], prev_pitch: Optional[int]) -> Tuple[int, int]:
        deg = _raw_degree(y_norm)
        pitch = scale_pool[deg]

        # Leaps > 4 degrees in the pentatonic: octave-fold while keeping the exact same pitch class!
        if prev_deg is not None and prev_pitch is not None and abs(deg - prev_deg) > 4:
            if deg > prev_deg and (deg - 5) >= 0:
                deg -= 5
                pitch = scale_pool[deg]
            elif deg < prev_deg and (deg + 5) < len(scale_pool):
                deg += 5
                pitch = scale_pool[deg]
        return pitch, deg

    # Group events by bar using their video frame
    total_frames = max(1, events[0].total_frames)
    bars_events: List[List[LightningEvent]] = [[] for _ in range(total_bars)]
    for ev in events:
        b_idx = min(total_bars - 1, max(0, int((ev.frame / float(total_frames)) * total_bars)))
        bars_events[b_idx].append(ev)

    melody_notes: List[NoteEvent] = []
    bar_counts: List[int] = []
    bar_is_sparse: Dict[int, bool] = {}
    max_anchors_per_bar = max(1, max_notes_per_bar // 4)

    for b_idx in range(total_bars):
        b_evs = bars_events[b_idx]
        if not b_evs:
            bar_counts.append(0)
            bar_is_sparse[b_idx] = True
            continue

        bar_f0 = (b_idx / float(total_bars)) * total_frames
        bar_f1 = ((b_idx + 1) / float(total_bars)) * total_frames

        # Select up to `max_anchors_per_bar` most persistent anchor events on distinct strong beats (0, 2, 4, 6)
        anchor_candidates = sorted(
            [ev for ev in b_evs if ev.is_anchor],
            key=lambda ev: (round(ev.persistence, 4), round(ev.intensity, 4), -ev.frame),
            reverse=True,
        )
        bar_anchor_slots: Dict[int, int] = {}
        used_strong_slots: set[int] = set()
        for cand in anchor_candidates:
            if len(bar_anchor_slots) >= max_anchors_per_bar:
                break
            if lightning_map == "scan":
                pref_slot = min((0, 2, 4, 6), key=lambda s: abs((s + 0.5) / 8.0 - cand.x_norm))
            else:
                rel_t = (cand.frame - bar_f0) / max(1.0, bar_f1 - bar_f0)
                r_s = min(7, max(0, int(math.floor(rel_t * 8.0))))
                pref_slot = r_s if (r_s % 2 == 0) else max(0, r_s - 1)
            if pref_slot not in used_strong_slots:
                used_strong_slots.add(pref_slot)
                bar_anchor_slots[id(cand)] = pref_slot

        # Determine the base slot (0..7 eighth-notes) of each event according to scan vs time
        ev_slots: List[Tuple[int, LightningEvent, bool]] = []
        for ev in b_evs:
            is_bar_anc = id(ev) in bar_anchor_slots
            if is_bar_anc:
                slot = bar_anchor_slots[id(ev)]
            elif lightning_map == "scan":
                slot = min(7, max(0, int(math.floor(ev.x_norm * 8.0))))
            else:
                rel_t = (ev.frame - bar_f0) / max(1.0, bar_f1 - bar_f0)
                slot = min(7, max(0, int(math.floor(rel_t * 8.0))))
            ev_slots.append((slot, ev, is_bar_anc))

        if lightning_map == "scan":
            ev_slots.sort(key=lambda item: (item[0], 0 if item[2] else 1, item[1].x_norm, -item[1].intensity))
        else:
            ev_slots.sort(key=lambda item: (item[0], 0 if item[2] else 1, item[1].frame, -item[1].intensity))

        raw_count = len(ev_slots)
        is_sparse = raw_count <= min_target_notes_per_bar
        is_excess = raw_count > max_notes_per_bar
        bar_is_sparse[b_idx] = is_sparse

        # 16th-note grid (subslot 0..15 -> 0.25 beat each) guarantees ZERO simultaneous notes
        occupied_subslots: Dict[int, _BarFlashCluster] = {}

        if not is_excess:
            # Place anchors first on even strong beats (subslot = slot * 2)
            for slot, ev, is_bar_anc in ev_slots:
                if is_bar_anc:
                    sub = slot * 2
                    occupied_subslots[sub] = _BarFlashCluster(
                        slot=slot, beat_offset=0.0, primary=ev, members=[ev], is_anchor=True
                    )
            # Place remaining events prioritizing free eighth-notes (0.5b) before sixteenth-notes (0.25b)
            for slot, ev, is_bar_anc in ev_slots:
                if is_bar_anc:
                    continue
                base_sub = slot * 2
                chosen_sub: Optional[int] = None
                for cand_sub in (base_sub, base_sub + 2, base_sub - 2, base_sub + 1):
                    if 0 <= cand_sub < 16 and cand_sub not in occupied_subslots:
                        chosen_sub = cand_sub
                        break
                if chosen_sub is not None:
                    occupied_subslots[chosen_sub] = _BarFlashCluster(
                        slot=chosen_sub // 2,
                        beat_offset=0.25 * (chosen_sub % 2),
                        primary=ev,
                        members=[ev],
                        is_anchor=False,
                    )
                else:
                    occupied_subslots[base_sub].members.append(ev)
        else:
            # Excess (> max_notes_per_bar): consolidate at most 1 primary cluster per eighth-note (slot 0..7)
            slot_buckets: Dict[int, List[Tuple[LightningEvent, bool]]] = {}
            for slot, ev, is_bar_anc in ev_slots:
                slot_buckets.setdefault(slot, []).append((ev, is_bar_anc))

            slot_clusters: List[_BarFlashCluster] = []
            for s_idx in sorted(slot_buckets.keys()):
                bucket = slot_buckets[s_idx]
                bucket.sort(
                    key=lambda pair: (
                        1 if pair[1] else 0,
                        round(pair[0].persistence, 4) if pair[1] else 0.0,
                        round(pair[0].intensity * math.sqrt(max(1e-5, pair[0].area_ratio)), 6),
                        -pair[0].frame,
                    ),
                    reverse=True,
                )
                prim_ev, prim_anc = bucket[0]
                slot_clusters.append(
                    _BarFlashCluster(
                        slot=s_idx,
                        beat_offset=0.0,
                        primary=prim_ev,
                        members=[p[0] for p in bucket],
                        is_anchor=prim_anc,
                    )
                )

            if lightning_mode == "strum":
                primary_cap = min(max_notes_per_bar, max(2, (max_notes_per_bar + 1) // 2 + 1))  # 5 for cap=8
            elif lightning_mode == "harmonic_bloom":
                primary_cap = min(max_notes_per_bar, max(2, max_notes_per_bar - 2))  # 6 for cap=8 (room to resonate)
            else:
                primary_cap = min(max_notes_per_bar, max(2, max_notes_per_bar - 2))  # 6 primary + up to 2 subdivisions = 8

            anchor_slots_set = {cl.slot for cl in slot_clusters if cl.is_anchor}
            ranked_slots = sorted(
                slot_clusters,
                key=lambda cl: (
                    1 if cl.is_anchor else 0,
                    # Small penalty for the eighth-note immediately after an anchor, letting the anchor breathe 1 beat
                    0 if (cl.is_anchor or (cl.slot - 1) not in anchor_slots_set) else -1,
                    round(cl.primary.persistence, 4) if cl.is_anchor else 0.0,
                    round(cl.primary.intensity * math.sqrt(max(1e-5, cl.primary.area_ratio)), 6),
                    len(cl.members),
                ),
                reverse=True,
            )

            kept_clusters = ranked_slots[:primary_cap]
            dropped_clusters = ranked_slots[primary_cap:]
            for d_cl in dropped_clusters:
                nearest_cl = min(kept_clusters, key=lambda k_cl: abs(k_cl.slot - d_cl.slot))
                nearest_cl.members.extend(d_cl.members)

            for k_cl in kept_clusters:
                occupied_subslots[k_cl.slot * 2] = k_cl

            # In `strum` and `subdivision`, use part of remaining budget on FREE sixteenth-notes (+0.25b) with distinct pitch
            if lightning_mode in ("strum", "subdivision"):
                max_extra = min(2, max(0, max_notes_per_bar - len(occupied_subslots)))
                rich_kept = sorted(
                    [cl for cl in kept_clusters if len(cl.members) >= 2],
                    key=lambda cl: (len(cl.members), round(cl.primary.intensity, 4)),
                    reverse=True,
                )
                added_extra = 0
                for cl in rich_kept:
                    if added_extra >= max_extra:
                        break
                    sub_off = cl.slot * 2 + 1
                    if sub_off >= 16 or sub_off in occupied_subslots:
                        continue
                    prim_deg = _raw_degree(cl.primary.y_norm)
                    # Pick secondary flash with a singable melodic interval (1..4 degrees, without repeating the same note)
                    distinct_members = [
                        m for m in cl.members[1:] if _raw_degree(m.y_norm) != prim_deg
                    ]
                    if not distinct_members and lightning_mode == "strum":
                        continue
                    sec_pool = distinct_members if distinct_members else cl.members[1:]
                    sec_pool.sort(
                        key=lambda m: (
                            1 if 1 <= abs(_raw_degree(m.y_norm) - prim_deg) <= 4 else 0,
                            round(m.intensity, 4),
                            -abs(abs(_raw_degree(m.y_norm) - prim_deg) - 2),
                        ),
                        reverse=True,
                    )
                    sec_ev = sec_pool[0]
                    cl.members = [m for m in cl.members if m is not sec_ev]
                    occupied_subslots[sub_off] = _BarFlashCluster(
                        slot=cl.slot,
                        beat_offset=0.25,
                        primary=sec_ev,
                        members=[sec_ev],
                        is_anchor=False,
                    )
                    added_extra += 1

        planned_items = [occupied_subslots[sub] for sub in sorted(occupied_subslots.keys())][:max_notes_per_bar]

        prev_deg: Optional[int] = None
        prev_pitch: Optional[int] = None
        bar_notes_added = 0

        for item in planned_items:
            ev = item.primary
            n_cluster = len(item.members)
            slot_global = min(total_bars * 8 - 1, b_idx * 8 + item.slot)
            local_mot = float(mot_slots[slot_global])

            # Anchor notes lock in the true geographic register on strong beats; passing notes fold leaps > 4 degrees
            ref_deg = None if item.is_anchor else prev_deg
            ref_pitch = None if item.is_anchor else prev_pitch
            pitch, deg = _quantize_pitch_and_degree(ev.y_norm, ref_deg, ref_pitch)
            prev_deg, prev_pitch = deg, pitch

            start_beat = round(min(total_beats - 0.15, b_idx * 4.0 + item.slot * 0.5 + item.beat_offset), 4)
            area_norm = min(1.0, math.sqrt(max(0.0, ev.area_ratio * 45.0)))

            if is_sparse:
                # Few events (1–2 in the bar): long notes, soft attack, and long release
                dur_beats = 2.05 + 1.15 * area_norm + 0.55 * ev.intensity
                atk_sec = 0.068
                rel_sec = 1.65
            elif lightning_mode == "subdivision" and (is_excess or n_cluster >= 2):
                dur_beats = 0.36 + 0.34 * area_norm + 0.22 * ev.intensity
                atk_sec = 0.009
                rel_sec = 0.48
            else:
                dur_beats = 0.68 + 0.95 * area_norm + 0.42 * ev.intensity
                atk_sec = 0.015
                rel_sec = 0.68

            if item.is_anchor:
                dur_beats *= 1.42
                rel_sec = min(1.8, rel_sec * 1.25)

            dur_beats = round(min(dur_beats, max(0.18, total_beats - start_beat)), 3)

            vel_base = 0.38 + 0.44 * ev.intensity + 0.06 * local_mot + (0.11 if item.is_anchor else 0.0)
            vel = round(float(np.clip(vel_base, 0.26, 0.94)), 3)

            # Local density opens attack harmonics and adds partials (octave/fifth) on the instrument itself
            density_ratio = min(1.0, (raw_count / float(max(1, max_notes_per_bar))) * 0.65 + 0.15 * (n_cluster - 1))
            bright = round(float(np.clip(0.26 + 0.48 * density_ratio + 0.20 * local_mot, 0.20, 0.98)), 3)

            if lightning_mode == "harmonic_bloom":
                partials = round(float(np.clip(0.32 * (n_cluster - 1) + (0.25 if is_excess else 0.0), 0.0, 1.0)), 3)
            else:
                partials = round(float(np.clip(0.18 * (n_cluster - 1), 0.0, 0.85)), 3)

            melody_notes.append(
                NoteEvent(
                    pitch=int(pitch),
                    note_name=midi_to_name(int(pitch)),
                    start_beat=start_beat,
                    duration_beats=dur_beats,
                    velocity=vel,
                    layer="melody",
                    bar=b_idx,
                    source_x=round(ev.x_norm, 4),
                    source_y=round(ev.y_norm, 4),
                    source_intensity=round(ev.intensity, 4),
                    attack_sec=round(atk_sec, 4),
                    release_sec=round(rel_sec, 3),
                    brightness=bright,
                    harmonic_partials=partials,
                    is_anchor=bool(item.is_anchor),
                    persistence=round(ev.persistence, 4),
                    cluster_size=n_cluster,
                )
            )
            bar_notes_added += 1

        bar_counts.append(bar_notes_added)

    melody_notes.sort(key=lambda n: (n.start_beat, n.pitch))

    # Clean monophonic / legato gate: prevents polyphonic stacking in MIDI (each note releases before the next)
    for idx_n, note in enumerate(melody_notes):
        next_sb = melody_notes[idx_n + 1].start_beat if (idx_n + 1) < len(melody_notes) else total_beats
        avail_gap = max(0.16, next_sb - note.start_beat)
        if bar_is_sparse.get(note.bar, False):
            gate_mul = 0.94
        elif lightning_mode == "subdivision":
            gate_mul = 0.72
        else:
            gate_mul = 0.92 if note.is_anchor else 0.84
        capped = min(note.duration_beats, avail_gap * gate_mul)
        if avail_gap > 0.18:
            capped = min(capped, avail_gap - 0.02)
        note.duration_beats = round(max(0.16, capped), 3)

    # ------------------------------------------------------------------------
    # Real-Time Hybrid Layer (`melody_sparkle`):
    #   - Level 1 (<=12 yellow dots in frame): pure/closed timbre, no doublings or sparkle.
    #   - Level 2 (13..48 yellow dots): opens metallic brightness + 5th/4th and 8ve harmonic doublings.
    #   - Level 3 (>=49 yellow dots): adds continuous high crystalline sparkle (16th/32nd)
    #     extracting X (pan) and Y (pitch) directly from the lit yellow dots in that exact frame!
    # ------------------------------------------------------------------------
    bursts = light_feat.frame_yellow_bursts
    neutral_pcs = {(key_root_pc + iv) % 12 for iv in NEUTRAL_SUSPENDED_PENTATONIC_IV}
    high_crystal_pool = [min(95, p + 12) for p in scale_pool]

    def _burst_at_beat(beat_val: float) -> dict:
        if not bursts:
            return {"dot_count": 0, "yellow_density": 0.0, "top_points": []}
        prog = float(np.clip(beat_val / max(1e-4, total_beats), 0.0, 1.0))
        idx_b = min(len(bursts) - 1, max(0, int(round(prog * (len(bursts) - 1)))))
        return bursts[idx_b]

    sparkle_notes: List[NoteEvent] = []
    bloom_count = 0
    crystal_count = 0

    for note in melody_notes:
        b_info = _burst_at_beat(note.start_beat)
        dots = int(b_info.get("dot_count", 0))
        y_dens = float(b_info.get("yellow_density", 0.0))

        if dots <= 12:
            # Few yellow dots: pure, velvety, closed timbre (no doublings)
            note.brightness = round(0.18 + 0.14 * min(1.0, dots / 12.0), 3)
            note.harmonic_partials = 0.0
        else:
            # Medium to high yellow density: opens weight, metallic brightness, and consonant doublings
            mid_prog = float(np.clip((dots - 12.0) / 36.0, 0.0, 1.0))
            note.brightness = round(min(0.98, 0.48 + 0.30 * mid_prog + 0.20 * y_dens), 3)
            note.harmonic_partials = round(min(1.0, 0.38 + 0.32 * mid_prog + 0.30 * y_dens), 3)

            # Perfect fifth (+7) if in the neutral suspended pentatonic, otherwise perfect fourth (+5)
            fifth_iv = 7 if ((note.pitch + 7) % 12) in neutral_pcs else 5
            fifth_pitch = min(92, note.pitch + fifth_iv)
            vel_5th = round(float(np.clip(note.velocity * (0.44 + 0.22 * mid_prog), 0.20, 0.68)), 3)
            sparkle_notes.append(
                NoteEvent(
                    pitch=int(fifth_pitch),
                    note_name=midi_to_name(int(fifth_pitch)),
                    start_beat=note.start_beat,
                    duration_beats=note.duration_beats,
                    velocity=vel_5th,
                    layer="melody_sparkle",
                    bar=note.bar,
                    source_x=note.source_x,
                    source_y=note.source_y,
                    source_intensity=note.source_intensity,
                    attack_sec=note.attack_sec,
                    release_sec=note.release_sec,
                    brightness=note.brightness,
                    harmonic_partials=round(0.25 * y_dens, 3),
                    sub_role="bloom_interval",
                )
            )
            bloom_count += 1

            if dots >= 26 and (note.pitch + 12) <= 94:
                oct_pitch = note.pitch + 12
                vel_oct = round(float(np.clip(note.velocity * (0.38 + 0.24 * y_dens), 0.18, 0.64)), 3)
                sparkle_notes.append(
                    NoteEvent(
                        pitch=int(oct_pitch),
                        note_name=midi_to_name(int(oct_pitch)),
                        start_beat=note.start_beat,
                        duration_beats=note.duration_beats,
                        velocity=vel_oct,
                        layer="melody_sparkle",
                        bar=note.bar,
                        source_x=note.source_x,
                        source_y=note.source_y,
                        source_intensity=note.source_intensity,
                        attack_sec=note.attack_sec,
                        release_sec=note.release_sec,
                        brightness=min(0.98, round((note.brightness or 0.7) + 0.10, 3)),
                        harmonic_partials=round(0.30 * y_dens, 3),
                        sub_role="bloom_interval",
                    )
                )
                bloom_count += 1

    # Continuous crystalline sparkle at real yellow-dot peaks on screen (>= 49 dots)
    total_sub32 = int(total_bars * 32)
    last_sp_pitch: Optional[int] = None
    for s32 in range(total_sub32):
        beat_t = round(s32 * 0.125, 4)
        b_info = _burst_at_beat(beat_t)
        dots = int(b_info.get("dot_count", 0))
        pts = b_info.get("top_points", [])
        if dots < 49 or not pts:
            last_sp_pitch = None
            continue

        # 49..129 dots -> sixteenth-notes (0.25b); >=130 dots -> crystalline thirty-second notes (0.125b)
        is_super_dense = dots >= 130
        if not is_super_dense and (s32 % 2 != 0):
            continue

        y_dens = float(b_info.get("yellow_density", 0.5))
        pt = pts[s32 % len(pts)]
        deg_sp = _raw_degree(float(pt["y_norm"]))
        sp_pitch = high_crystal_pool[deg_sp]

        # Ensure shimmering arpeggio movement by avoiding consecutive repeats of the same high bell
        if last_sp_pitch is not None and sp_pitch == last_sp_pitch:
            if len(pts) >= 2:
                alt_pt = pts[(s32 + 1) % len(pts)]
                alt_deg = _raw_degree(float(alt_pt["y_norm"]))
                if high_crystal_pool[alt_deg] != last_sp_pitch:
                    pt = alt_pt
                    deg_sp = alt_deg
                    sp_pitch = high_crystal_pool[deg_sp]
            if sp_pitch == last_sp_pitch:
                alt_deg2 = deg_sp + 2 if (deg_sp + 2) < len(high_crystal_pool) else max(0, deg_sp - 2)
                sp_pitch = high_crystal_pool[alt_deg2]

        last_sp_pitch = sp_pitch
        sp_dur = 0.11 if is_super_dense else 0.22
        sp_vel = round(float(np.clip(0.22 + 0.20 * y_dens + 0.08 * float(pt["intensity"]), 0.20, 0.48)), 3)
        b_idx_sp = min(total_bars - 1, int(beat_t // 4.0))

        sparkle_notes.append(
            NoteEvent(
                pitch=int(sp_pitch),
                note_name=midi_to_name(int(sp_pitch)),
                start_beat=beat_t,
                duration_beats=sp_dur,
                velocity=sp_vel,
                layer="melody_sparkle",
                bar=b_idx_sp,
                source_x=round(float(pt["x_norm"]), 4),
                source_y=round(float(pt["y_norm"]), 4),
                source_intensity=round(float(pt["intensity"]), 4),
                attack_sec=0.006,
                release_sec=0.24,
                brightness=round(0.75 + 0.23 * y_dens, 3),
                sub_role="crystal_sparkle",
            )
        )
        crystal_count += 1

    sparkle_notes.sort(key=lambda n: (n.start_beat, n.pitch))
    anchor_count = sum(1 for n in melody_notes if n.is_anchor)
    max_obs_bar = max(bar_counts) if bar_counts else 0
    max_yellow_dots = max((int(b.get("dot_count", 0)) for b in bursts), default=0)

    map_desc = "Varredura Geográfica (scan X->tempo)" if lightning_map == "scan" else "Cronologia Direta (time)"
    style_pt = f"Celesta/Rhodes Pentatônica Suspensa — {map_desc} [{lightning_mode}]"

    melody_params = {
        "role": "instrument",
        "stem_file": "melody.wav",
        "fixed_gain": STEM_GAINS["melody"],
        "lightning_map": lightning_map,
        "lightning_mode": lightning_mode,
        "lightning_pitch_range": lightning_pitch_range,
        "scale_type": "neutral_suspended_pentatonic (1, 2, 4, 5, b7)",
        "scale_pitch_classes": [(key_root_pc + iv) % 12 for iv in NEUTRAL_SUSPENDED_PENTATONIC_IV],
        "max_notes_per_bar": max_notes_per_bar,
        "min_target_notes_per_bar": min_target_notes_per_bar,
        "extracted_event_count": len(events),
        "max_frame_yellow_dots": max_yellow_dots,
        "note_count": len(melody_notes),
        "sparkle_note_count": len(sparkle_notes),
        "bloom_interval_count": bloom_count,
        "crystal_sparkle_count": crystal_count,
        "anchor_note_count": anchor_count,
        "notes_per_bar": round(len(melody_notes) / max(1, total_bars), 2),
        "bar_note_counts": bar_counts,
        "max_observed_notes_in_bar": max_obs_bar,
        "optical_flow_mean": round(light_feat.motion_mean, 4),
        "style_name_pt": style_pt,
    }

    explanation = {
        "layer_id": "melody",
        "role": "instrument",
        "layer_name_pt": "Instrumento: Melodia (Raios ISS)",
        "source_map": "Raios e Relâmpagos Anuais vistos da ISS (NASA SOS)",
        "video_file": light_feat.video_file,
        "extracted_metrics": {
            "extracted_events": len(events),
            "max_frame_yellow_dots": max_yellow_dots,
            "persistence_hotspots": len(light_feat.persistence_hotspots),
            "lightning_mean_index": round(light_feat.mean_index, 3),
            "lightning_optical_flow": round(light_feat.motion_mean, 3),
        },
        "musical_decisions": {
            "mapeamento_temporal": lightning_map,
            "modo_alta_densidade": lightning_mode,
            "escala": f"Pentatônica suspensa neutra de {active_session['key_root']}",
            "notas_principais": len(melody_notes),
            "dobras_5a_8a": bloom_count,
            "cintilacao_cristalina": crystal_count,
            "notas_ancora_persistentes": anchor_count,
            "max_notas_por_compasso": f"{max_obs_bar}/{max_notes_per_bar}",
        },
        "rule_applied": (
            f"Modo '{lightning_map}' + '{lightning_mode}': linha principal monofônica com notas-âncora em "
            "tempos fortes + resposta híbrida em tempo real aos pontos amarelos do quadro (<=12 puro, "
            "13..48 abre 5ª/8ª, >=49 aciona cintilação cristalina aguda contínua)."
        ),
        "ui_summary_pt": (
            f"A atividade elétrica ({len(events)} eventos, pico {max_yellow_dots} pts/frame) gerou "
            f"{len(melody_notes)} notas principais + {crystal_count} cintilações agudas."
        ),
    }
    return melody_params, melody_notes, sparkle_notes, explanation


# ============================================================================
# 5. Full Score Orchestration from the Frozen Plan
# ============================================================================

def compose_jukebox_score(
    bbox: GeoBoundingBox,
    features: Dict[str, LayerFeatures],
    total_bars: int = 8,
    tuning: str = "region",
    lightning_map: str = "scan",
    lightning_mode: str = "strum",
    lightning_pitch_range: str = "fixed",
    bass_follows_harmony: bool = True,
    max_melody_notes_per_bar: int = 8,
    control_plan: Optional[dict] = None,
) -> dict:
    """
    Builds the frozen plan (if not yet provided) and composes the 3 independent instruments.
    """
    plan = control_plan or build_control_plan(
        bbox=bbox,
        features=features,
        total_bars=total_bars,
        tuning=tuning,
        lightning_map=lightning_map,
    )

    chords_params, pad_notes, exp_chords = compose_chords_instrument(features["chords"], plan)
    bass_params, bass_notes, exp_bass = compose_bass_instrument(
        features["bass"], plan, bass_follows_harmony=bass_follows_harmony
    )
    melody_params, melody_notes, sparkle_notes, exp_melody = compose_melody_instrument(
        features["melody"],
        plan,
        lightning_map=lightning_map,
        lightning_mode=lightning_mode,
        lightning_pitch_range=lightning_pitch_range,
        max_notes_per_bar=max_melody_notes_per_bar,
    )

    active_s = plan["session"]["active"]
    h_plan = plan["harmony_plan"]
    overview_pt = (
        f"Earth Jukebox — {bbox.name} "
        f"(lat [{bbox.lat_min:.1f}°, {bbox.lat_max:.1f}°], lon [{bbox.lon_min:.1f}°, {bbox.lon_max:.1f}°]): "
        f"sessão ({tuning}) em {active_s['key_root_pt']} ({active_s['key_root']}) a {active_s['bpm']} BPM "
        f"({active_s['duration_seconds']:.1f}s, {total_bars} compassos). "
        f"{exp_chords['ui_summary_pt']} {exp_bass['ui_summary_pt']} "
        f"{exp_melody['ui_summary_pt']} {plan['wind_explanation']['ui_summary_pt']}"
    )

    return {
        "metadata": {
            "architecture": "earth_jukebox_v2",
            "region_name": bbox.name,
            "region_description": bbox.description,
            "bounding_box": plan["bbox"],
        },
        "session": plan["session"],
        "harmony_plan": h_plan,
        "melody_scan_cursors": plan["melody_scan_cursors"],
        "control_curves": plan["control_curves"],
        "musical_parameters": {
            "temperature": {
                "role": "conductor",
                "tuning": tuning,
                "bpm": active_s["bpm"],
                "key_root": active_s["key_root"],
                "key_root_pc": active_s["key_root_pc"],
                "key_root_pt": active_s["key_root_pt"],
                "total_bars": total_bars,
                "duration_seconds": active_s["duration_seconds"],
                "temperature_mean_index": active_s["temperature_mean_index"],
            },
            "chords": chords_params,
            "bass": bass_params,
            "melody": melody_params,
            "wind": plan["wind_plan"],
        },
        "explanations": {
            "overview_pt": overview_pt,
            "layers": [
                exp_melody,
                exp_chords,
                plan["conductor_explanation"],
                exp_bass,
                plan["wind_explanation"],
            ],
        },
        "raw_layer_features": {k: v.to_dict() for k, v in features.items()},
        "tracks": {
            "chords": h_plan["chords"],
            "chords_pad": [asdict(n) for n in pad_notes],
            "bass": [asdict(n) for n in bass_notes],
            "melody": [asdict(n) for n in melody_notes],
            "melody_sparkle": [asdict(n) for n in sparkle_notes],
        },
    }
