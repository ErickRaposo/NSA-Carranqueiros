"""
Earth Jukebox Orchestrator: strictly separates Frozen Analysis (`analyze_region`)
from Selective Composition/Rendering (`render_from_analysis` / `generate_region_soundscape`).

Outputs generated in `output_dir`:
  - `chords.wav`, `bass.wav`, `melody.wav` (dry stems with fixed gains for enabled instruments)
  - `mix_dry.wav`   (exact sum of enabled dry stems)
  - `mix_wind.wav`  (linear wind bus applied over `mix_dry` when `wind='on'`)
  - `manifest.json` (base/region session, harmony_plan, stem_gains, layer->video mapping,
                     dependencies, and per-bar melody scan cursors)
  - `score.json`, `explanation.md`, `music.mid`, and `videos/*.mp4` (when enabled)
"""

from dataclasses import dataclass
import json
from pathlib import Path
import time
from typing import Dict, Iterable, List, Optional

from .config import (
    ALL_LAYERS,
    BASE_DIR,
    INSTRUMENT_LAYERS,
    LAYER_ROLES,
    MASTER_LIMITER_THRESHOLD,
    STEM_GAINS,
    VIDEO_FILES,
    GeoBoundingBox,
    normalize_layer_id,
)
from .geo_extractor import (
    LayerFeatures,
    SynchronizedLayerStream,
    extract_all_layer_streams,
)
from .midi_writer import export_score_to_midi
from .music_engine import build_control_plan, compose_jukebox_score
from .synth_renderer import SAMPLE_RATE, render_jukebox_audio
from .video_renderer import MAP_H, PANEL_W, render_synchronized_videos


@dataclass
class FrozenRegionAnalysis:
    """Frozen state of physical analysis and control plan (independent of layer visibility toggles)."""
    bbox: GeoBoundingBox
    streams: Dict[str, SynchronizedLayerStream]
    features: Dict[str, LayerFeatures]
    control_plans_by_tuning: Dict[str, dict]  # Pre-frozen 'base' and 'region'


def parse_enabled_layers(layers_spec: Optional[Iterable[str] | str]) -> List[str]:
    """Parses `--layers` and returns an ordered subset of `('chords', 'bass', 'melody')`."""
    if layers_spec is None:
        return list(INSTRUMENT_LAYERS)
    if isinstance(layers_spec, str):
        raw = layers_spec.strip().lower()
        if raw in ("all", "*"):
            return list(INSTRUMENT_LAYERS)
        if raw in ("none", "off", "empty", ""):
            return []
        tokens = [t.strip() for t in raw.replace(";", ",").split(",") if t.strip()]
    else:
        tokens = [str(t).strip() for t in layers_spec if str(t).strip()]
        if len(tokens) == 1 and tokens[0].lower() in ("none", "off", "empty"):
            return []
        if len(tokens) == 1 and tokens[0].lower() in ("all", "*"):
            return list(INSTRUMENT_LAYERS)

    normalized = {normalize_layer_id(t) for t in tokens}
    unknown = normalized - set(ALL_LAYERS)
    if unknown:
        raise ValueError(
            f"Camadas desconhecidas em --layers: {sorted(unknown)}. "
            f"Instrumentos válidos: {list(INSTRUMENT_LAYERS)}"
        )
    return [inst for inst in INSTRUMENT_LAYERS if inst in normalized]


def format_explanation_markdown(score: dict, manifest: dict) -> str:
    meta = score["metadata"]
    bb = meta["bounding_box"]
    s_act = score["session"]["active"]
    h_p = score["harmony_plan"]
    toggles = manifest["layer_toggles"]

    lines = [
        f"# Earth Jukebox — {meta['region_name']}",
        "",
        f"- **Coordenadas (Bounding Box):** Lat `[{bb['lat_min']}°, {bb['lat_max']}°]` | Lon `[{bb['lon_min']}°, {bb['lon_max']}°]`",
        f"- **Sessão Ativa (`--tuning {toggles['tuning']}`):** {s_act['key_root_pt']} ({s_act['key_root']}) a `{s_act['bpm']} BPM` (`{s_act['duration_seconds']}s`, {s_act['total_bars']} compassos 4/4)",
        f"- **Plano Harmônico (`harmony_plan`):** {h_p['mode_name_pt']} — `{' → '.join(h_p['chord_progression'])}`",
        f"- **Instrumentos Ligados (`--layers`):** `{', '.join(toggles['enabled_instruments']) or 'nenhum'}` | **Bus de Vento (`--wind`):** `{toggles['wind']}`",
        "",
        "## Resumo Geral",
        "",
        f"> {score['explanations']['overview_pt']}",
        "",
        "## Papéis e Decisões por Camada",
        "",
    ]

    for layer in score["explanations"]["layers"]:
        lines.append(f"### [{layer.get('role', '').upper()}] {layer['layer_name_pt']} — *{layer['source_map']}*")
        lines.append(f"- **Resumo:** {layer['ui_summary_pt']}")
        lines.append(f"- **Regra Aplicada:** {layer['rule_applied']}")
        metrics_str = ", ".join(f"`{k}={v}`" for k, v in layer["extracted_metrics"].items())
        decisions_str = ", ".join(f"**{k}**: {v}" for k, v in layer["musical_decisions"].items())
        lines.append(f"- **Métricas dos Pixels:** {metrics_str}")
        lines.append(f"- **Decisões Musicais:** {decisions_str}")
        lines.append("")

    return "\n".join(lines)


def build_manifest(
    score: dict,
    features: Dict[str, LayerFeatures],
    enabled_instruments: List[str],
    tuning: str,
    wind_mode: str,
    lightning_map: str,
    lightning_mode: str,
    lightning_pitch_range: str,
    bass_follows_harmony: bool,
    temperature_color: bool,
    audio_files: dict,
) -> dict:
    """Builds `manifest.json` per the Section 8 specification."""
    layer_video_map = {}
    for lid in ALL_LAYERS:
        feat = features[lid]
        layer_video_map[lid] = {
            "role": LAYER_ROLES[lid],
            "video_file": feat.video_file,
            "source_duration_sec": round(feat.source_duration_sec, 3),
            "source_fps": round(feat.source_fps, 2),
            "resampled_analysis_frames": feat.analysis_frames,
        }

    dependencies = {
        "temperature": {
            "role": "conductor",
            "depends_on": ["temperature_video"],
            "provides": ["session.region (key_root, bpm)"],
            "has_own_stem": False,
        },
        "chords": {
            "role": "instrument",
            "depends_on": ["chords_video", f"session.{tuning}.key_root", f"session.{tuning}.bpm"],
            "provides": ["harmony_plan", "chords.wav"],
            "has_own_stem": True,
        },
        "bass": {
            "role": "instrument",
            "depends_on": (
                ["bass_video", f"session.{tuning}.bpm", "harmony_plan.chords"]
                if bass_follows_harmony
                else ["bass_video", f"session.{tuning}.key_root", f"session.{tuning}.bpm"]
            ),
            "bass_follows_harmony": bool(bass_follows_harmony),
            "provides": ["bass.wav"],
            "has_own_stem": True,
        },
        "melody": {
            "role": "instrument",
            "depends_on": ["melody_video", f"session.{tuning}.key_root", f"session.{tuning}.bpm"],
            "depends_on_harmony_plan": False,
            "provides": ["melody.wav"],
            "has_own_stem": True,
        },
        "wind": {
            "role": "effect",
            "depends_on": ["wind_video", f"session.{tuning}.bpm", "sum(enabled_instrument_stems)"],
            "generates_own_sound": False,
            "linear_bus": True,
            "provides": ["mix_wind.wav"],
            "has_own_stem": False,
        },
    }

    return {
        "architecture": "earth_jukebox_v2",
        "region": score["metadata"]["bounding_box"],
        "layer_toggles": {
            "enabled_instruments": enabled_instruments,
            "tuning": tuning,
            "temperature_conductor_active": (tuning == "region"),
            "wind": wind_mode,
            "temperature_color": bool(temperature_color),
        },
        "parameters": {
            "layers": enabled_instruments,
            "tuning": tuning,
            "wind": wind_mode,
            "lightning_map": lightning_map,
            "lightning_mode": lightning_mode,
            "lightning_pitch_range": lightning_pitch_range,
            "bass_follows_harmony": bool(bass_follows_harmony),
            "temperature_color": bool(temperature_color),
            "sample_rate": SAMPLE_RATE,
        },
        "session": score["session"],
        "harmony_plan": score["harmony_plan"],
        "stem_gains": {
            "instruments": dict(STEM_GAINS),
            "relative_normalization": False,
            "master_soft_limiter_threshold": MASTER_LIMITER_THRESHOLD,
        },
        "layer_to_video": layer_video_map,
        "dependencies": dependencies,
        "melody_scan_cursors": score["melody_scan_cursors"],
        "outputs": audio_files,
    }


def analyze_region(
    bbox: GeoBoundingBox,
    video_dir: Path = BASE_DIR,
    total_bars: int = 8,
    frames_per_bar: int = 20,
    video_overrides: Optional[Dict[str, Path]] = None,
    time_start_sec: Optional[float] = None,
    window_span_sec: Optional[float] = None,
    preview_out_path: Optional[Path] = None,
    lightning_map: str = "scan",
) -> FrozenRegionAnalysis:
    """
    Isolated Phase 1: extracts the 5 videos onto the common timeline and pre-freezes the `ControlPlan`
    for both conductor modes (`base` and `region`).
    """
    bbox = bbox.validate()
    streams = extract_all_layer_streams(
        bbox=bbox,
        video_dir=video_dir,
        total_bars=total_bars,
        frames_per_bar=frames_per_bar,
        tile_size=(PANEL_W, MAP_H),
        video_overrides=video_overrides,
        time_start_sec=time_start_sec,
        window_span_sec=window_span_sec,
        preview_out_path=preview_out_path,
    )
    features = {k: s.features for k, s in streams.items()}
    plans = {
        "base": build_control_plan(
            bbox=bbox, features=features, total_bars=total_bars, tuning="base", lightning_map=lightning_map
        ),
        "region": build_control_plan(
            bbox=bbox, features=features, total_bars=total_bars, tuning="region", lightning_map=lightning_map
        ),
    }
    return FrozenRegionAnalysis(
        bbox=bbox,
        streams=streams,
        features=features,
        control_plans_by_tuning=plans,
    )


def render_from_analysis(
    analysis: FrozenRegionAnalysis,
    output_dir: Path,
    layers: Optional[Iterable[str] | str] = None,
    tuning: str = "region",
    wind: str = "on",
    lightning_map: str = "scan",
    lightning_mode: str = "strum",
    lightning_pitch_range: str = "fixed",
    bass_follows_harmony: bool = True,
    temperature_color: bool = False,
    max_melody_notes_per_bar: int = 8,
    video_fps: int = 24,
    render_wav: bool = True,
    render_video: bool = False,
    only_videos: Optional[Iterable[str]] = None,
    render_midi: bool = True,
    seamless_loop: bool = False,
) -> dict:
    """
    Phase 2: uses the frozen `FrozenRegionAnalysis` (without re-analyzing videos) to render
    any combination of layers (`--layers`), `--tuning`, and `--wind`.
    """
    t0 = time.perf_counter()
    if tuning not in ("base", "region"):
        raise ValueError(f"tuning inválido: {tuning}")
    if wind not in ("on", "off"):
        raise ValueError(f"wind inválido: {wind} (use 'on' ou 'off')")

    enabled_instruments = parse_enabled_layers(layers)
    wind_enabled = wind == "on"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Use the frozen plan (updating only the cursor metadata if lightning_map differs)
    frozen_plan = dict(analysis.control_plans_by_tuning[tuning])
    if frozen_plan["melody_scan_cursors"][0]["mapping_mode"] != lightning_map:
        frozen_plan = build_control_plan(
            bbox=analysis.bbox,
            features=analysis.features,
            total_bars=int(frozen_plan["session"]["active"]["total_bars"]),
            tuning=tuning,
            lightning_map=lightning_map,
        )

    score = compose_jukebox_score(
        bbox=analysis.bbox,
        features=analysis.features,
        total_bars=int(frozen_plan["session"]["active"]["total_bars"]),
        tuning=tuning,
        lightning_map=lightning_map,
        lightning_mode=lightning_mode,
        lightning_pitch_range=lightning_pitch_range,
        bass_follows_harmony=bass_follows_harmony,
        max_melody_notes_per_bar=max_melody_notes_per_bar,
        control_plan=frozen_plan,
    )

    stem_files: Dict[str, str] = {}
    mix_dry_str: Optional[str] = None
    mix_wind_str: Optional[str] = None
    video_files: Dict[str, str] = {}

    num_vid_frames = (
        max(8, int(round(float(score["session"]["active"]["duration_seconds"]) * video_fps)))
        if render_video
        else 0
    )

    if render_wav or render_video:
        audio_bundle = render_jukebox_audio(
            score=score,
            output_dir=output_dir,
            enabled_layers=enabled_instruments,
            wind_enabled=wind_enabled,
            temperature_color=temperature_color,
            num_video_frames=num_vid_frames,
            seamless_loop=seamless_loop,
        )
        stem_files = {k: str(p) for k, p in audio_bundle.stem_paths.items()}
        mix_dry_str = str(audio_bundle.mix_dry_path)
        mix_wind_str = str(audio_bundle.mix_wind_path)

        if render_video:
            video_files = render_synchronized_videos(
                streams=analysis.streams,
                score=score,
                audio_bundle=audio_bundle,
                output_dir=output_dir,
                fps=video_fps,
                enabled_layers=enabled_instruments,
                wind_enabled=wind_enabled,
                only_videos=only_videos,
            )

    midi_path: Optional[Path] = None
    if render_midi:
        midi_path = export_score_to_midi(
            score,
            output_dir / "music.mid",
            enabled_layers=enabled_instruments,
            wind_enabled=wind_enabled,
        )

    audio_outputs_meta = {
        "stems_dry_wav": {k: Path(p).name for k, p in stem_files.items()},
        "mix_dry_wav": Path(mix_dry_str).name if mix_dry_str else None,
        "mix_wind_wav": Path(mix_wind_str).name if mix_wind_str else None,
        "midi": midi_path.name if midi_path else None,
    }

    manifest = build_manifest(
        score=score,
        features=analysis.features,
        enabled_instruments=enabled_instruments,
        tuning=tuning,
        wind_mode=wind,
        lightning_map=lightning_map,
        lightning_mode=lightning_mode,
        lightning_pitch_range=lightning_pitch_range,
        bass_follows_harmony=bass_follows_harmony,
        temperature_color=temperature_color,
        audio_files=audio_outputs_meta,
    )

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)

    score_path = output_dir / "score.json"
    with open(score_path, "w", encoding="utf-8") as fp:
        json.dump(score, fp, ensure_ascii=False, indent=2)

    md_path = output_dir / "explanation.md"
    md_path.write_text(format_explanation_markdown(score, manifest), encoding="utf-8")

    elapsed = round(time.perf_counter() - t0, 2)
    return {
        "score": score,
        "manifest": manifest,
        "elapsed_seconds": elapsed,
        "files": {
            "manifest_json": str(manifest_path),
            "score_json": str(score_path),
            "explanation_md": str(md_path),
            "midi": str(midi_path) if midi_path else None,
            "stems_wav": stem_files,
            "mix_dry_wav": mix_dry_str,
            "mix_wind_wav": mix_wind_str,
            "videos_mp4": video_files,
        },
    }


def generate_region_soundscape(
    bbox: GeoBoundingBox,
    output_dir: Path,
    video_dir: Path = BASE_DIR,
    video_overrides: Optional[Dict[str, Path]] = None,
    time_start_sec: Optional[float] = None,
    window_span_sec: Optional[float] = None,
    total_bars: int = 8,
    frames_per_bar: int = 20,
    layers: Optional[Iterable[str] | str] = None,
    tuning: str = "region",
    wind: str = "on",
    lightning_map: str = "scan",
    lightning_mode: str = "strum",
    lightning_pitch_range: str = "fixed",
    bass_follows_harmony: bool = True,
    temperature_color: bool = False,
    max_melody_notes_per_bar: int = 8,
    video_fps: int = 24,
    render_wav: bool = True,
    render_video: bool = True,
    only_videos: Optional[Iterable[str]] = None,
    render_midi: bool = True,
    save_preview: bool = True,
    seamless_loop: bool = False,
) -> dict:
    """Runs Frozen Analysis + full Earth Jukebox rendering."""
    t0 = time.perf_counter()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    preview_path = (output_dir / "region_crops.png") if save_preview else None

    analysis = analyze_region(
        bbox=bbox,
        video_dir=video_dir,
        total_bars=total_bars,
        frames_per_bar=frames_per_bar,
        video_overrides=video_overrides,
        time_start_sec=time_start_sec,
        window_span_sec=window_span_sec,
        preview_out_path=preview_path,
        lightning_map=lightning_map,
    )
    res = render_from_analysis(
        analysis=analysis,
        output_dir=output_dir,
        layers=layers,
        tuning=tuning,
        wind=wind,
        lightning_map=lightning_map,
        lightning_mode=lightning_mode,
        lightning_pitch_range=lightning_pitch_range,
        bass_follows_harmony=bass_follows_harmony,
        temperature_color=temperature_color,
        max_melody_notes_per_bar=max_melody_notes_per_bar,
        video_fps=video_fps,
        render_wav=render_wav,
        render_video=render_video,
        only_videos=only_videos,
        render_midi=render_midi,
        seamless_loop=seamless_loop,
    )
    res["elapsed_seconds"] = round(time.perf_counter() - t0, 2)
    res["files"]["preview_png"] = str(preview_path) if preview_path else None
    return res
