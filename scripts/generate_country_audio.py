#!/usr/bin/env python3
"""
Earth Jukebox — Pipeline Batch de Áudio & Partitura MIDI (nasa-geo-sonification) por País.

Gera, para cada país em `public/countries/<id>/`:
  - `region/{chords,bass,melody_main,melody_sparkle}_{dry,wind}.ogg`
  - `base/{chords,bass,melody_main,melody_sparkle}_{dry,wind}.ogg`
  - Atualiza `meta.json` com `hasAudioStems: true`, `audioFormat: "ogg"`,
    `session` (`region` & `base`), `beatEvents` e `studio` (partitura MIDI completa p/ Piano-Roll
    da Parede Direita + telemetria `yellowCounts` e `persistentPeaks` idêntica ao `jukebox_studio.py`).
  - Atualiza `public/countries/index.json` com a lista estrita de países 100% gerados (zero fallback).

Uso:
  python scripts/generate_country_audio.py                 # Gera os 12 países em destaque
  python scripts/generate_country_audio.py --ids=076,818   # Países específicos
  python scripts/generate_country_audio.py --all           # Todos os países com pasta em public/countries/
"""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

import cv2
import numpy as np

# Garante import de `scripts/nasa_soundscape`
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from nasa_soundscape.config import (
    ALL_LAYERS,
    BASE_DIR,
    VIDEO_FILES,
    GeoBoundingBox,
)
from nasa_soundscape.geo_extractor import (
    SynchronizedLayerStream,
    bbox_to_pixels,
    extract_layer_stream,
)
from nasa_soundscape.music_engine import build_control_plan, compose_jukebox_score
from nasa_soundscape.synth_renderer import (
    SAMPLE_RATE,
    apply_wind_bus,
    render_instrument_stem,
    write_pcm16_wav,
)

TOTAL_BARS = 8
FRAMES_PER_BAR = 12
NUM_FRAMES = TOTAL_BARS * FRAMES_PER_BAR  # 96 quadros canônicos
ATLAS_W = 2048
ATLAS_H = 1024
TILE_W = 320
TILE_H = 214
SHEET_COLS = 12
SHEET_ROWS = 8
SHEET_FRAME_SIZE = 160
MARGIN_RATIO = 0.08
HEADROOM_SCALE = 0.50

COUNTRIES_DIR = BASE_DIR / "public" / "countries"
REMOTE_STAGING_DIR = BASE_DIR / "outputs" / "supabase-countries" / "countries"
ATLAS_DIR = BASE_DIR / "outputs" / ".studio_cache" / "global_atlas_96f"
SPLIT_PLAN_PATH = BASE_DIR / "outputs" / "country_split_plan.json"

EXCLUDED_COUNTRY_IDS = {"156"}
DEFAULT_FEATURED_IDS = "076,840,250,392,276,818,356,484,036,710,620"
DEFAULT_AUDIO_QUALITY = "2"
DEFAULT_SHEET_QUALITY = 76

MODE_EN_MAP = {
    "lydian": "Lydian (Clean Air)",
    "ionian": "Ionian (Major)",
    "mixolydian": "Mixolydian",
    "dorian": "Atmospheric Dorian",
    "aeolian": "Aeolian (Minor)",
    "phrygian": "Dense Phrygian",
}

STEM_NAMES = (
    "chords_dry",
    "chords_wind",
    "bass_dry",
    "bass_wind",
    "melody_main_dry",
    "melody_main_wind",
    "melody_sparkle_dry",
    "melody_sparkle_wind",
)

LAYER_PNG_NAMES = ("melody.png", "chords.png", "temperature.png", "bass.png", "wind.png")

_ATLAS_MEM: dict[str, dict] = {}


def ensure_layer_atlas(layer_id: str) -> dict:
    if layer_id in _ATLAS_MEM:
        return _ATLAS_MEM[layer_id]

    ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    atlas_path = ATLAS_DIR / f"{layer_id}.atlas"

    if not atlas_path.exists():
        vpath = BASE_DIR / VIDEO_FILES[layer_id]
        if not vpath.exists():
            raise FileNotFoundError(f"Vídeo NASA não encontrado: {vpath}")

        print(f"[Atlas] Indexando 96 quadros de '{layer_id}' ({vpath.name})...", flush=True)
        cap = cv2.VideoCapture(str(vpath))
        if not cap.isOpened():
            raise RuntimeError(f"Não foi possível abrir {vpath}")

        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        total_frames = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
        src_dur = total_frames / max(1e-3, src_fps)

        target_idxs = np.round(np.linspace(0, total_frames - 1, NUM_FRAMES)).astype(int)
        wanted_map: dict[int, list[int]] = {}
        for out_slot, f_idx in enumerate(target_idxs):
            wanted_map.setdefault(int(f_idx), []).append(out_slot)

        max_wanted = int(target_idxs[-1])
        jpeg_slots: list[bytes] = [b""] * NUM_FRAMES
        last_jpg = b""

        for cur_f in range(max_wanted + 1):
            if not cap.grab():
                break
            if cur_f not in wanted_map:
                continue
            ok, frame_bgr = cap.retrieve()
            if ok and frame_bgr is not None:
                if src_w != ATLAS_W or src_h != ATLAS_H:
                    interp = cv2.INTER_AREA if src_w > ATLAS_W else cv2.INTER_LINEAR
                    frame_bgr = cv2.resize(frame_bgr, (ATLAS_W, ATLAS_H), interpolation=interp)
                ok_j, enc = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                if ok_j:
                    last_jpg = enc.tobytes()
            for slot in wanted_map[cur_f]:
                jpeg_slots[slot] = last_jpg
        cap.release()

        for i in range(NUM_FRAMES):
            if not jpeg_slots[i] and last_jpg:
                jpeg_slots[i] = last_jpg

        header = struct.pack("<IIIdd", NUM_FRAMES, ATLAS_W, ATLAS_H, src_dur, src_fps)
        chunks = [header]
        for jb in jpeg_slots:
            chunks.append(struct.pack("<I", len(jb)))
            chunks.append(jb)
        tmp_path = atlas_path.with_suffix(".tmp")
        tmp_path.write_bytes(b"".join(chunks))
        tmp_path.replace(atlas_path)

    raw = atlas_path.read_bytes()
    n_frames, aw, ah, src_dur, src_fps = struct.unpack_from("<IIIdd", raw, 0)
    offset = struct.calcsize("<IIIdd")
    jpegs: list[bytes] = []
    for _ in range(n_frames):
        (jlen,) = struct.unpack_from("<I", raw, offset)
        offset += 4
        jpegs.append(raw[offset : offset + jlen])
        offset += jlen

    entry = {
        "n_frames": n_frames,
        "width": aw,
        "height": ah,
        "src_dur": src_dur,
        "src_fps": src_fps,
        "jpegs": jpegs,
    }
    _ATLAS_MEM[layer_id] = entry
    return entry


def ensure_all_atlases() -> None:
    missing = [lid for lid in ALL_LAYERS if not (ATLAS_DIR / f"{lid}.atlas").exists()]
    if missing:
        with ThreadPoolExecutor(max_workers=5) as ex:
            list(ex.map(ensure_layer_atlas, ALL_LAYERS))
    else:
        for lid in ALL_LAYERS:
            ensure_layer_atlas(lid)


def extract_layer_from_atlas(layer_id: str, bbox: GeoBoundingBox) -> tuple[str, SynchronizedLayerStream]:
    atlas = ensure_layer_atlas(layer_id)
    aw, ah = atlas["width"], atlas["height"]
    x0, x1, y0, y1 = bbox_to_pixels(bbox, aw, ah)
    cw = x1 - x0
    interp = cv2.INTER_AREA if cw > TILE_W else cv2.INTER_LINEAR

    tiles: list[np.ndarray] = []
    for jb in atlas["jpegs"]:
        arr = np.frombuffer(jb, dtype=np.uint8)
        full_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        crop = full_bgr[y0:y1, x0:x1]
        tiles.append(cv2.resize(crop, (TILE_W, TILE_H), interpolation=interp))

    geom = np.array([aw, ah, x0, x1, y0, y1], dtype=np.int32)
    stream = extract_layer_stream(
        layer_id=layer_id,
        video_path=BASE_DIR / VIDEO_FILES[layer_id],
        bbox=bbox,
        total_bars=TOTAL_BARS,
        frames_per_bar=FRAMES_PER_BAR,
        tile_size=(TILE_W, TILE_H),
        predecoded_tiles_override=(tiles, geom, atlas["src_dur"], atlas["src_fps"]),
    )
    return layer_id, stream


def export_country_video_sheets(country_dir: Path, raw_bbox: list[float], sheet_quality: int = DEFAULT_SHEET_QUALITY) -> None:
    """
    Gera 5 sprite sheets JPEG (12x8 = 96 quadros, 160x160 px cada) em `video/<layer>_sheet.jpg`
    diretamente dos 5 vídeos originais da NASA SVS (`global_atlas_96f`), alinhados 1:1 com a
    projeção Plate Carrée (`cos_lat`, MARGIN_RATIO=0.08) da silhueta `1024x1024` do país.
    """
    min_lon, min_lat, max_lon, max_lat = [float(v) for v in raw_bbox]
    mid_lat_rad = ((min_lat + max_lat) * 0.5) * math.pi / 180.0
    cos_lat = max(0.18, math.cos(mid_lat_rad))
    geo_w = max(0.05, (max_lon - min_lon) * cos_lat)
    geo_h = max(0.05, max_lat - min_lat)

    fsz = SHEET_FRAME_SIZE
    usable = float(fsz) * (1.0 - 2.0 * MARGIN_RATIO)
    scale = usable / max(geo_w, geo_h)
    drawn_w = geo_w * scale
    drawn_h = geo_h * scale
    offset_x = (float(fsz) - drawn_w) * 0.5
    offset_y = (float(fsz) - drawn_h) * 0.5

    yy, xx = np.mgrid[0:fsz, 0:fsz]
    ix_grid = xx.astype(np.float64) + 0.5
    iy_grid = yy.astype(np.float64) + 0.5
    lon_grid = min_lon + (ix_grid - offset_x) / (cos_lat * scale)
    lat_grid = max_lat - (iy_grid - offset_y) / scale

    map_x = ((((lon_grid + 180.0) / 360.0) % 1.0) * (ATLAS_W - 1)).astype(np.float32)
    map_y = (np.clip((90.0 - lat_grid) / 180.0, 0.0, 1.0) * (ATLAS_H - 1)).astype(np.float32)

    # Máscara da silhueta do país vinda do PNG 1024x1024 para destacar fronteiras sem perder contexto externo
    mask_weight = np.ones((fsz, fsz, 1), dtype=np.float32)
    border_mask = np.zeros((fsz, fsz), dtype=bool)
    ref_png = country_dir / "melody.png"
    if ref_png.exists():
        bgra = cv2.imread(str(ref_png), cv2.IMREAD_UNCHANGED)
        if bgra is not None and bgra.shape[2] == 4:
            alpha = cv2.resize(bgra[:, :, 3], (fsz, fsz), interpolation=cv2.INTER_AREA)
            inside = (alpha > 8).astype(np.float32)
            # Fora do país fica mais escuro (0.20x) para destacar a silhueta, mas mantém nuvens/raios ao redor visíveis
            mask_weight = (0.20 + 0.80 * inside)[:, :, None].astype(np.float32)
            kernel = np.ones((3, 3), dtype=np.uint8)
            inside_u8 = (alpha > 8).astype(np.uint8)
            dilated = cv2.dilate(inside_u8, kernel, iterations=1)
            border_mask = (dilated - inside_u8) > 0

    video_dir = country_dir / "video"
    video_dir.mkdir(parents=True, exist_ok=True)

    def _build_sheet(lid: str) -> None:
        atlas = ensure_layer_atlas(lid)
        sheet = np.zeros((SHEET_ROWS * fsz, SHEET_COLS * fsz, 3), dtype=np.uint8)
        for idx in range(min(NUM_FRAMES, len(atlas["jpegs"]))):
            arr = np.frombuffer(atlas["jpegs"][idx], dtype=np.uint8)
            full_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if full_bgr is None:
                continue
            warped = cv2.remap(
                full_bgr,
                map_x,
                map_y,
                interpolation=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_WRAP,
            )
            framed = np.clip(warped.astype(np.float32) * mask_weight, 0, 255).astype(np.uint8)
            if np.any(border_mask):
                framed[border_mask] = (
                    framed[border_mask].astype(np.float32) * 0.45
                    + np.array([175.0, 195.0, 220.0], dtype=np.float32) * 0.55
                ).astype(np.uint8)

            r = idx // SHEET_COLS
            c = idx % SHEET_COLS
            sheet[r * fsz : (r + 1) * fsz, c * fsz : (c + 1) * fsz] = framed

        out_path = video_dir / f"{lid}_sheet.jpg"
        cv2.imwrite(str(out_path), sheet, [int(cv2.IMWRITE_JPEG_QUALITY), int(sheet_quality)])

    with ThreadPoolExecutor(max_workers=5) as ex:
        list(ex.map(_build_sheet, ["melody", "chords", "temperature", "bass", "wind"]))


def encode_wav_to_ogg(
    stereo_sig: np.ndarray,
    out_ogg: Path,
    tmp_dir: Path,
    name: str,
    audio_quality: str = DEFAULT_AUDIO_QUALITY,
) -> None:
    wav_tmp = tmp_dir / f"{name}.wav"
    ogg_tmp = tmp_dir / f"{name}.ogg"
    write_pcm16_wav(stereo_sig, wav_tmp, SAMPLE_RATE)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(wav_tmp),
            "-c:a",
            "libvorbis",
            "-q:a",
            str(audio_quality),
            str(ogg_tmp),
        ],
        check=True,
    )
    out_ogg.parent.mkdir(parents=True, exist_ok=True)
    ogg_tmp.replace(out_ogg)
    if wav_tmp.exists():
        wav_tmp.unlink()


def compact_note(n: dict, include_anchor: bool = True, include_sub_role: bool = False) -> dict:
    item: dict = {
        "start_beat": round(float(n.get("start_beat", 0.0)), 3),
        "duration_beats": round(float(n.get("duration_beats", 0.5)), 3),
        "pitch": int(n.get("pitch", 60)),
        "velocity": round(float(n.get("velocity", 0.75)), 3),
        "source_x": round(float(n.get("source_x", 0.5)), 3),
        "source_y": round(float(n.get("source_y", 0.5)), 3),
    }
    if include_anchor:
        item["is_anchor"] = bool(n.get("is_anchor", False))
    if include_sub_role:
        item["sub_role"] = str(n.get("sub_role", "bloom_interval"))
    return item


def build_studio_session_payload(score: dict) -> dict:
    s_act = score["session"]["active"]
    h_plan = score["harmony_plan"]
    m_p = score["musical_parameters"]["melody"]
    c_p = score["musical_parameters"]["chords"]
    b_p = score["musical_parameters"]["bass"]
    w_p = score["musical_parameters"]["wind"]
    mode_id = str(h_plan.get("mode_id", "dorian"))

    mel_notes = [compact_note(n, include_anchor=True) for n in score["tracks"].get("melody", [])]
    spk_notes = [
        compact_note(sp, include_anchor=False, include_sub_role=True)
        for sp in score["tracks"].get("melody_sparkle", [])
    ]
    chd_notes = [compact_note(c, include_anchor=False) for c in score["tracks"].get("chords_pad", [])]
    bas_notes = [compact_note(b, include_anchor=True) for b in score["tracks"].get("bass", [])]

    return {
        "tuningMode": str(s_act.get("tuning_mode", "region")),
        "bpm": int(round(float(s_act.get("bpm", 90)))),
        "keyRoot": str(s_act.get("key_root", "A")),
        "keyRootPt": str(s_act.get("key_root_pt", "Lá")),
        "durationSeconds": round(float(s_act.get("duration_seconds", 16.0)), 2),
        "totalBars": int(s_act.get("total_bars", TOTAL_BARS)),
        "modeId": mode_id,
        "modeNamePt": str(h_plan.get("mode_name_pt", "Dórico Atmosférico")),
        "modeNameEn": MODE_EN_MAP.get(mode_id, "Atmospheric Dorian"),
        "chordProgression": list(h_plan.get("chord_progression", []))[:TOTAL_BARS],
        "musicalParameters": {
            "melody": {
                "noteCount": int(m_p.get("note_count", len(mel_notes))),
                "anchorNoteCount": int(m_p.get("anchor_note_count", 0)),
                "sparkleCount": len(spk_notes),
                "lightningMap": str(m_p.get("lightning_map", "time")),
                "lightningMode": str(m_p.get("lightning_mode", "strum")),
            },
            "chords": {
                "noteCount": int(c_p.get("note_count", len(chd_notes))),
                "voicingStyle": str(c_p.get("voicing_style", "")),
            },
            "bass": {
                "noteCount": int(b_p.get("note_count", len(bas_notes))),
                "cutoffHz": int(round(float(b_p.get("mean_cutoff_hz", b_p.get("lowpass_cutoff_hz", 180))))),
                "drive": round(float(b_p.get("mean_drive", b_p.get("harmonic_drive", 0.1))), 3),
            },
            "wind": {
                "reverbDecaySeconds": round(float(w_p.get("reverb_decay_seconds", 2.1)), 2),
                "meanSpeed": round(float(w_p.get("mean_speed", 0.35)), 3),
            },
        },
        "tracks": {
            "melody": mel_notes,
            "melody_sparkle": spk_notes,
            "chords_pad": chd_notes,
            "bass": bas_notes,
        },
    }


def extract_beat_events(score: dict) -> list[dict]:
    events: list[dict] = []

    for n in score["tracks"].get("melody", []):
        events.append(
            {
                "beat": int(round(float(n.get("start_beat", 0.0)))) % 32,
                "layer": "melody",
                "source_x": round(float(n.get("source_x", 0.5)), 3),
                "source_y": round(float(n.get("source_y", 0.5)), 3),
                "pitch": int(n.get("pitch", 69)),
                "velocity": round(float(n.get("velocity", 0.85)), 4),
                "isAnchor": bool(n.get("is_anchor", False)),
            }
        )

    for sp in score["tracks"].get("melody_sparkle", []):
        events.append(
            {
                "beat": int(round(float(sp.get("start_beat", 0.0)))) % 32,
                "layer": "sparkle",
                "source_x": round(float(sp.get("source_x", 0.5)), 3),
                "source_y": round(float(sp.get("source_y", 0.5)), 3),
                "pitch": int(sp.get("pitch", 81)),
                "velocity": round(float(sp.get("velocity", 0.72)), 4),
                "isAnchor": False,
            }
        )

    for b in score["tracks"].get("bass", []):
        events.append(
            {
                "beat": int(round(float(b.get("start_beat", 0.0)))) % 32,
                "layer": "bass",
                "source_x": round(float(b.get("source_x", 0.5)), 3),
                "source_y": round(float(b.get("source_y", 0.25)), 3),
                "pitch": int(b.get("pitch", 36)),
                "velocity": round(float(b.get("velocity", 0.82)), 4),
                "isAnchor": bool(b.get("is_anchor", False)),
            }
        )

    for idx, c_note in enumerate(score["tracks"].get("chords_pad", [])):
        if idx % 3 == 0:
            events.append(
                {
                    "beat": int(round(float(c_note.get("start_beat", 0.0)))) % 32,
                    "layer": "chords",
                    "source_x": round(float(c_note.get("source_x", 0.5)), 3),
                    "source_y": round(float(c_note.get("source_y", 0.5)), 3),
                    "pitch": int(c_note.get("pitch", 60)),
                    "velocity": round(float(c_note.get("velocity", 0.75)), 4),
                    "isAnchor": idx == 0,
                }
            )

    events.sort(key=lambda e: (e["beat"], e["layer"]))
    return events


def process_country(
    country_dir: Path,
    force: bool = False,
    audio_quality: str = DEFAULT_AUDIO_QUALITY,
    sheet_quality: int = DEFAULT_SHEET_QUALITY,
    compact_json: bool = True,
) -> None:
    country_id = country_dir.name
    if country_id in EXCLUDED_COUNTRY_IDS:
        print(f"[Skip] {country_id} (China excluída conforme regra da instalação).", flush=True)
        return
    meta_path = country_dir / "meta.json"
    if not meta_path.exists():
        return

    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    required_oggs = [
        country_dir / tun / f"{stem}.ogg"
        for tun in ("region", "base")
        for stem in STEM_NAMES
    ]
    oggs_ready = all(p.exists() for p in required_oggs)
    studio_ready = bool(
        meta.get("studio")
        and meta["studio"].get("sessions", {}).get("region")
        and meta["studio"].get("windProfile")
    )
    videos_ready = all((country_dir / "video" / f"{lid}_sheet.jpg").exists() for lid in ALL_LAYERS)

    if not force and meta.get("hasAudioStems") and oggs_ready and studio_ready and videos_ready:
        print(f"[Skip] {country_id} ({meta.get('namePt', country_id)}) já possui 16 OGGs + studio MIDI + 5 vídeos NASA.", flush=True)
        return

    lon_min, lat_min, lon_max, lat_max = meta["bbox"]
    name_pt = meta.get("namePt", country_id)
    bbox = GeoBoundingBox(
        lat_min=float(lat_min),
        lat_max=float(lat_max),
        lon_min=float(lon_min),
        lon_max=float(lon_max),
        name=name_pt,
    ).validate()

    t0 = time.perf_counter()

    if not videos_ready or force:
        export_country_video_sheets(country_dir, meta["bbox"], sheet_quality=sheet_quality)
    ordered = ["melody", "chords", "temperature", "bass", "wind"]
    with ThreadPoolExecutor(max_workers=5) as ex:
        pairs = list(ex.map(lambda lid: extract_layer_from_atlas(lid, bbox), ordered))
    streams = dict(pairs)
    features = {k: s.features for k, s in streams.items()}

    region_score = None
    session_payload = {}
    studio_sessions = {}

    need_synth = force or not oggs_ready

    for tuning in ("region", "base"):
        plan = build_control_plan(
            bbox=bbox,
            features=features,
            total_bars=TOTAL_BARS,
            tuning=tuning,
            lightning_map="time",
        )
        score = compose_jukebox_score(
            bbox=bbox,
            features=features,
            total_bars=TOTAL_BARS,
            tuning=tuning,
            lightning_map="time",
            lightning_mode="strum",
            lightning_pitch_range="fixed",
            bass_follows_harmony=True,
            max_melody_notes_per_bar=8,
            control_plan=plan,
        )
        if tuning == "region":
            region_score = score

        studio_sessions[tuning] = build_studio_session_payload(score)

        bpm = float(score["session"]["active"]["bpm"])
        wind_params = score["musical_parameters"]["wind"]
        sp_list = score["tracks"].get("melody_sparkle", [])

        if need_synth:
            def _render_pair(kind: str) -> tuple[str, np.ndarray, str, np.ndarray]:
                if kind == "chords":
                    dry = render_instrument_stem(
                        "chords",
                        score["tracks"]["chords_pad"],
                        bpm,
                        TOTAL_BARS,
                        seamless_loop=True,
                        sr=SAMPLE_RATE,
                        gain_override=HEADROOM_SCALE,
                    )
                    wnd = apply_wind_bus(dry, wind_params, bpm, seamless_loop=True, sr=SAMPLE_RATE)
                    return "chords_dry", dry, "chords_wind", wnd
                if kind == "bass":
                    dry = render_instrument_stem(
                        "bass",
                        score["tracks"]["bass"],
                        bpm,
                        TOTAL_BARS,
                        seamless_loop=True,
                        sr=SAMPLE_RATE,
                        gain_override=HEADROOM_SCALE,
                    )
                    wnd = apply_wind_bus(dry, wind_params, bpm, seamless_loop=True, sr=SAMPLE_RATE)
                    return "bass_dry", dry, "bass_wind", wnd
                if kind == "melody_main":
                    dry = render_instrument_stem(
                        "melody",
                        score["tracks"]["melody"],
                        bpm,
                        TOTAL_BARS,
                        seamless_loop=True,
                        sr=SAMPLE_RATE,
                        sparkle_notes=None,
                        gain_override=HEADROOM_SCALE,
                    )
                    wnd = apply_wind_bus(dry, wind_params, bpm, seamless_loop=True, sr=SAMPLE_RATE)
                    return "melody_main_dry", dry, "melody_main_wind", wnd
                dry = render_instrument_stem(
                    "melody",
                    [],
                    bpm,
                    TOTAL_BARS,
                    seamless_loop=True,
                    sr=SAMPLE_RATE,
                    sparkle_notes=sp_list,
                    gain_override=HEADROOM_SCALE,
                    sparkle_gain=1.0,
                )
                if len(sp_list) > 0:
                    wnd = apply_wind_bus(dry, wind_params, bpm, seamless_loop=True, sr=SAMPLE_RATE)
                else:
                    wnd = np.zeros_like(dry)
                return "melody_sparkle_dry", dry, "melody_sparkle_wind", wnd

            with ThreadPoolExecutor(max_workers=4) as ex:
                rendered = list(ex.map(_render_pair, ["chords", "bass", "melody_main", "melody_sparkle"]))

            tuning_dir = country_dir / tuning
            with tempfile.TemporaryDirectory() as tmp:
                tmp_dir = Path(tmp)
                tasks = []
                with ThreadPoolExecutor(max_workers=4) as ex:
                    for k_dry, s_dry, k_wnd, s_wnd in rendered:
                        tasks.append(
                            ex.submit(
                                encode_wav_to_ogg,
                                s_dry,
                                tuning_dir / f"{k_dry}.ogg",
                                tmp_dir,
                                k_dry,
                                audio_quality,
                            )
                        )
                        tasks.append(
                            ex.submit(
                                encode_wav_to_ogg,
                                s_wnd,
                                tuning_dir / f"{k_wnd}.ogg",
                                tmp_dir,
                                k_wnd,
                                audio_quality,
                            )
                        )
                    for t in tasks:
                        t.result()

        s_act = score["session"]["active"]
        h_plan = score["harmony_plan"]
        mode_id = h_plan.get("mode_id", "dorian")
        session_payload[tuning] = {
            "bpm": int(round(bpm)),
            "keyRoot": s_act["key_root"],
            "keyRootPt": s_act["key_root_pt"],
            "modeNamePt": h_plan.get("mode_name_pt", "Dórico Atmosférico"),
            "modeNameEn": MODE_EN_MAP.get(mode_id, "Atmospheric Dorian"),
            "chords": h_plan.get("chord_progression", [])[:8],
            "windMeanSpeed": round(float(wind_params.get("mean_speed", 0.35)) * 20.0, 1),
        }

    bursts = features["melody"].frame_yellow_bursts or []
    yellow_counts = [int(b.get("dot_count", 0)) for b in bursts]
    persistent_peaks = []
    if region_score is not None:
        persistent_peaks = [
            [round(float(n.get("source_x", 0.5)), 3), round(float(n.get("source_y", 0.5)), 3)]
            for n in region_score["tracks"].get("melody", [])
            if n.get("is_anchor")
        ]

    wind_feat = features["wind"]
    wind_profile = {
        "orientation": [round(float(v), 3) for v in (wind_feat.wind_orientation_series or [])],
        "hotspotX": [round(float(p.x_norm), 3) for p in (wind_feat.slot_hotspots or [])],
        "hotspotY": [round(float(p.y_norm), 3) for p in (wind_feat.slot_hotspots or [])],
        "speed": [round(float(v), 3) for v in (wind_feat.time_series or [])],
        "turbulence": [round(float(v), 3) for v in (wind_feat.wind_turbulence_series or [])],
    }

    meta["hasAudioStems"] = True
    meta["audioFormat"] = "ogg"
    meta["session"] = session_payload
    meta["studio"] = {
        "numFrames": NUM_FRAMES,
        "yellowCounts": yellow_counts,
        "persistentPeaks": persistent_peaks,
        "windProfile": wind_profile,
        "videoSpec": {
            "cols": SHEET_COLS,
            "rows": SHEET_ROWS,
            "numFrames": NUM_FRAMES,
            "frameSize": SHEET_FRAME_SIZE,
            "format": "jpg",
            "source": "nasa-svs-original",
        },
        "sessions": studio_sessions,
    }
    if region_score is not None:
        meta["beatEvents"] = extract_beat_events(region_score)

    if compact_json:
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    else:
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    elapsed = time.perf_counter() - t0
    mode_tag = "16 OGGs + studio MIDI" if need_synth else "studio MIDI atualizado"
    print(f"[OK] {country_id} ({name_pt}) -> {mode_tag} em {elapsed:.2f}s", flush=True)


def _process_country_worker(task: tuple[str, bool, str, int, bool]) -> None:
    dir_str, force, audio_quality, sheet_quality, compact_json = task
    process_country(
        Path(dir_str),
        force=force,
        audio_quality=audio_quality,
        sheet_quality=sheet_quality,
        compact_json=compact_json,
    )


def _is_complete_country_dir(d: Path) -> bool:
    if not d.is_dir() or d.name in EXCLUDED_COUNTRY_IDS:
        return False
    if not (d / "meta.json").exists():
        return False
    if not all((d / png).exists() for png in LAYER_PNG_NAMES):
        return False
    if not all((d / "video" / f"{lid}_sheet.jpg").exists() for lid in ALL_LAYERS):
        return False
    if not all((d / tun / f"{stem}.ogg").exists() for tun in ("region", "base") for stem in STEM_NAMES):
        return False
    return True


def write_generated_countries_index() -> list[str]:
    generated: list[str] = []
    if COUNTRIES_DIR.exists():
        for d in sorted(COUNTRIES_DIR.iterdir()):
            if _is_complete_country_dir(d):
                generated.append(d.name)

    local_set = set(generated)
    remote: list[str] = []
    if REMOTE_STAGING_DIR.exists():
        for d in sorted(REMOTE_STAGING_DIR.iterdir()):
            if d.name not in local_set and _is_complete_country_dir(d):
                remote.append(d.name)

    payload: dict = {
        "generatedIds": generated,
        "remoteIds": remote,
        "localCount": len(generated),
        "remoteCount": len(remote),
        "count": len(generated),
        "totalCount": len(generated) + len(remote),
        "excludedIds": sorted(EXCLUDED_COUNTRY_IDS),
    }

    idx_path = COUNTRIES_DIR / "index.json"
    if idx_path.exists():
        try:
            prev = json.loads(idx_path.read_text(encoding="utf-8"))
            if prev.get("remoteBaseUrl"):
                payload["remoteBaseUrl"] = prev["remoteBaseUrl"]
            if prev.get("remoteBucket"):
                payload["remoteBucket"] = prev["remoteBucket"]
        except Exception:
            pass

    idx_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"[Index] public/countries/index.json atualizado: {len(generated)} locais + {len(remote)} Supabase = {len(generated) + len(remote)} países",
        flush=True,
    )
    return generated


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera stems OGG + studio MIDI do nasa-geo-sonification por país.")
    parser.add_argument("--all", action="store_true", help="Processa todos os países na pasta alvo")
    parser.add_argument("--split-hybrid", action="store_true", help="Processa os 100 locais em public/countries/ e o restante em outputs/supabase-countries/countries/")
    parser.add_argument("--out-dir", type=str, default=str(COUNTRIES_DIR), help="Pasta base de países (padrão: public/countries)")
    parser.add_argument("--ids", type=str, default=DEFAULT_FEATURED_IDS, help="IDs separados por vírgula")
    parser.add_argument("--force", action="store_true", help="Regenera stems OGG mesmo se já existirem")
    parser.add_argument("--audio-quality", type=str, default=DEFAULT_AUDIO_QUALITY, help="Qualidade libvorbis (-q:a, padrão 2 ~96kbps)")
    parser.add_argument("--sheet-quality", type=int, default=DEFAULT_SHEET_QUALITY, help="Qualidade JPEG dos sprite sheets (padrão 76)")
    parser.add_argument("--pretty-json", action="store_true", help="Formata meta.json com indentação ao invés de minificar")
    parser.add_argument("--workers", type=int, default=max(1, min(4, (os.cpu_count() or 4) // 2)), help="Processos paralelos de país")
    args = parser.parse_args()

    print("[1/2] Verificando Atlas Global de 96 quadros (5 vídeos NASA)...", flush=True)
    ensure_all_atlases()

    dirs: list[Path] = []
    if args.split_hybrid:
        for base in (COUNTRIES_DIR, REMOTE_STAGING_DIR):
            if base.exists():
                dirs.extend(
                    sorted(
                        [
                            d
                            for d in base.iterdir()
                            if d.is_dir() and d.name not in EXCLUDED_COUNTRY_IDS and (d / "meta.json").exists()
                        ]
                    )
                )
    else:
        target_dir = Path(args.out_dir)
        if not target_dir.is_absolute():
            target_dir = BASE_DIR / target_dir
        if args.all:
            dirs = sorted(
                [
                    d
                    for d in target_dir.iterdir()
                    if d.is_dir() and d.name not in EXCLUDED_COUNTRY_IDS and (d / "meta.json").exists()
                ]
            )
        else:
            wanted = [s.strip() for s in args.ids.split(",") if s.strip() and s.strip() not in EXCLUDED_COUNTRY_IDS]
            dirs = [target_dir / cid for cid in wanted if (target_dir / cid / "meta.json").exists()]

    print(
        f"[2/2] Processando áudio e partitura MIDI para {len(dirs)} país(es) (workers={args.workers}, -q:a {args.audio_quality}, sheet={args.sheet_quality})...",
        flush=True,
    )
    compact_json = not args.pretty_json
    tasks = [(str(d), args.force, args.audio_quality, args.sheet_quality, compact_json) for d in dirs]

    if args.workers <= 1 or len(tasks) <= 1:
        for t in tasks:
            _process_country_worker(t)
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as ex:
            list(ex.map(_process_country_worker, tasks))

    write_generated_countries_index()


if __name__ == "__main__":
    main()
