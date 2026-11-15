#!/usr/bin/env python3
"""
Renderizador multiplataforma (Windows/Linux/macOS) dos 5 PNGs 1024x1024 RGBA recortados na silhueta
de cada país + meta.json inicial, espelhando 1:1 a especificação de `render_country_layers.swift`.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter

CANVAS_SIZE = 1024
MARGIN_RATIO = 0.08
SUPERSAMPLE = 2

LAYER_SPECS = [
    ("melody", (251, 191, 36)),       # #fbbf24
    ("chords", (251, 146, 60)),       # #fb923c
    ("temperature", (251, 113, 133)), # #fb7185
    ("bass", (52, 211, 153)),         # #34d399
    ("wind", (56, 189, 248)),         # #38bdf8
]


def _extract_frame_rgb(video_path: Path, frac: float, w: int = 2048, h: int = 1024) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    total = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
    idx = min(total - 1, max(0, int(round((total - 1) * frac))))
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, bgr = cap.read()
    cap.release()
    if not ok or bgr is None:
        return None
    if bgr.shape[1] != w or bgr.shape[0] != h:
        interp = cv2.INTER_AREA if bgr.shape[1] > w else cv2.INTER_LINEAR
        bgr = cv2.resize(bgr, (w, h), interpolation=interp)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def ensure_cached_nasa_frames(workspace: Path, cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    w, h = 2048, 1024

    l_path = cache_dir / "svs5011.png"
    if not l_path.exists():
        vpath = workspace / "public" / "nasa" / "svs5011_lightning_sos_4096x2048.mp4"
        best_rgb = np.zeros((h, w, 3), dtype=np.uint8)
        best_score = np.full((h, w), -999999, dtype=np.int32)
        for idx in range(12):
            frac = (idx + 0.5) / 12.0
            rgb = _extract_frame_rgb(vpath, frac, w, h)
            if rgb is None:
                continue
            r = rgb[:, :, 0].astype(np.int32)
            g = rgb[:, :, 1].astype(np.int32)
            b = rgb[:, :, 2].astype(np.int32)
            score = r + g - b
            mask = score > best_score
            best_score[mask] = score[mask]
            best_rgb[mask] = rgb[mask]
        cv2.imwrite(str(l_path), cv2.cvtColor(best_rgb, cv2.COLOR_RGB2BGR))

    w_path = cache_dir / "svs5148_comp.png"
    if not w_path.exists():
        vpath = workspace / "public" / "nasa" / "svs5148_wind_2048x1024.mp4"
        best_rgb = np.zeros((h, w, 3), dtype=np.uint8)
        best_score = np.full((h, w), -1.0, dtype=np.float32)
        for idx in range(10):
            frac = (idx + 0.5) / 10.0
            rgb = _extract_frame_rgb(vpath, frac, w, h)
            if rgb is None:
                continue
            f = rgb.astype(np.float32) / 255.0
            max_c = f.max(axis=2)
            min_c = f.min(axis=2)
            chroma = max_c - min_c
            score = np.where(
                (chroma < 0.05) & (max_c < 0.45),
                0.0,
                chroma * 1.4 + (1.0 - min_c) * 0.25,
            )
            mask = score > best_score
            best_score[mask] = score[mask]
            best_rgb[mask] = rgb[mask]
        cv2.imwrite(str(w_path), cv2.cvtColor(best_rgb, cv2.COLOR_RGB2BGR))

    singles = [
        ("public/nasa/svs5147_temp_2048x1024.mp4", "svs5147.png", 0.35),
        ("public/nasa/svs5153_co_2048x1024.mp4", "svs5153.png", 0.35),
        ("public/nasa/svs5154_nox_2048x1024.mp4", "svs5154.png", 0.35),
    ]
    for rel_video, out_name, frac in singles:
        out_p = cache_dir / out_name
        if not out_p.exists():
            rgb = _extract_frame_rgb(workspace / rel_video, frac, w, h)
            if rgb is None:
                raise RuntimeError(f"Failed to read NASA frame from {rel_video}")
            cv2.imwrite(str(out_p), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))


def build_decoded_field(img_path: Path, kind: str) -> np.ndarray:
    bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(f"Missing cached image {img_path}")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rn = rgb[:, :, 0]
    gn = rgb[:, :, 1]
    bn = rgb[:, :, 2]
    lum = 0.299 * rn + 0.587 * gn + 0.114 * bn
    max_c = np.maximum(rn, np.maximum(gn, bn))
    min_c = np.minimum(rn, np.minimum(gn, bn))
    chroma = max_c - min_c

    border_mask = np.zeros(rn.shape, dtype=bool)

    if kind == "melody":
        yellow = np.maximum(0.0, (rn * 0.55 + gn * 0.45) - bn * 1.15)
        raw = np.where(chroma < 0.08, 0.0, np.clip((yellow - 0.06) / 0.68, 0.0, 1.0))
    elif kind == "chords":
        border_mask = (max_c < 0.26) & (chroma < 0.07)
        drop_gb = np.clip(1.0 - gn * 0.72 - bn * 0.38, 0.0, 1.0)
        maroon_boost = np.where((rn > gn * 2.0) & (gn < 0.22), np.maximum(0.0, 0.92 - rn) * 0.55, 0.0)
        raw = np.clip((drop_gb * 0.76 + maroon_boost - 0.10) / 0.86, 0.0, 1.0)
    elif kind == "temperature":
        cold = np.minimum(1.0, (bn - rn) * 1.15)
        heat = np.maximum(0.0, rn * 0.65 + (1.0 - gn) * 0.58 - bn * 0.35)
        warm_val = np.clip((heat - 0.18) / 0.72, 0.08, 0.95)
        raw = np.where(
            bn > rn + 0.10,
            0.22 + 0.62 * cold,
            np.where((chroma < 0.08) & (lum > 0.35) & (lum < 0.78), 0.96, warm_val),
        )
    elif kind == "bass":
        border_mask = (max_c < 0.22) & ((gn - np.maximum(rn, bn)) < 0.04)
        nox = 1.0 - lum
        raw = np.clip((nox - 0.10) / 0.72, 0.0, 1.0)
    elif kind == "wind":
        border_mask = (chroma < 0.06) & (lum < 0.52)
        speed_score = chroma * 1.35 + np.maximum(0.0, 0.85 - lum) * 0.35
        raw = np.where(
            (chroma < 0.06) & (lum >= 0.52),
            0.04,
            np.clip((speed_score - 0.05) / 0.78, 0.05, 1.0),
        )
    else:
        raw = np.zeros_like(rn)

    raw = raw.astype(np.float32)

    if kind in ("chords", "bass", "wind") and np.any(border_mask):
        valid = (~border_mask).astype(np.float32)
        kernel = np.ones((5, 5), dtype=np.float32)
        num = cv2.filter2D(raw * valid, -1, kernel, borderType=cv2.BORDER_REPLICATE)
        den = cv2.filter2D(valid, -1, kernel, borderType=cv2.BORDER_REPLICATE)
        replaced = np.where(den > 0, num / np.maximum(1e-6, den), raw)
        cleaned = np.where(border_mask, replaced, raw)
        return cleaned.astype(np.float32)

    return raw


def sample_bilinear_grid(field: np.ndarray, lon_grid: np.ndarray, lat_grid: np.ndarray) -> np.ndarray:
    h, w = field.shape
    u = (lon_grid + 180.0) / 360.0
    u = u - np.floor(u)
    v = np.clip((90.0 - lat_grid) / 180.0, 0.0, 1.0)

    fx = u * (w - 1)
    fy = v * (h - 1)

    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    x1 = (x0 + 1) % w
    y1 = np.minimum(h - 1, y0 + 1)

    tx = (fx - x0).astype(np.float32)
    ty = (fy - y0).astype(np.float32)

    c00 = field[y0, x0]
    c10 = field[y0, x1]
    c01 = field[y1, x0]
    c11 = field[y1, x1]

    top = c00 * (1.0 - tx) + c10 * tx
    bot = c01 * (1.0 - tx) + c11 * tx
    return (top * (1.0 - ty) + bot * ty).astype(np.float32)


def smooth_canvas_field(canvas_raw: np.ndarray, fill_mask: np.ndarray, sigma: float) -> np.ndarray:
    w_mask = (fill_mask.astype(np.float32)) / 255.0
    num = gaussian_filter(canvas_raw * w_mask, sigma=sigma, mode="nearest", truncate=2.6)
    den = gaussian_filter(w_mask, sigma=sigma, mode="nearest", truncate=2.6)
    out = np.where((fill_mask > 0) & (den > 1e-6), num / np.maximum(1e-6, den), 0.0)
    return out.astype(np.float32)


def photoshop_alpha(val01: np.ndarray, layer_id: str) -> np.ndarray:
    v = np.clip(val01, 0.0, 1.0)
    if layer_id == "melody":
        t = np.minimum(1.0, np.maximum(0.0, (v - 0.05) / 0.55))
        curved = np.power(t, 0.82)
        alpha_f = np.where(v < 0.05, 5.0 + (v / 0.05) * 10.0, 18.0 + curved * (235.0 - 18.0))
    else:
        curved = np.power(v, 1.95)
        alpha_f = 8.0 + curved * (235.0 - 8.0)
    return np.clip(np.round(alpha_f), 0, 235).astype(np.float32)


def render_manifest(manifest_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    workspace = Path(manifest["workspaceDir"])
    cache_dir = Path(manifest["cacheDir"])
    out_base_dir = Path(manifest["outBaseDir"])

    ensure_cached_nasa_frames(workspace, cache_dir)

    fields = {
        "melody": build_decoded_field(cache_dir / "svs5011.png", "melody"),
        "chords": build_decoded_field(cache_dir / "svs5153.png", "chords"),
        "temperature": build_decoded_field(cache_dir / "svs5147.png", "temperature"),
        "bass": build_decoded_field(cache_dir / "svs5154.png", "bass"),
        "wind": build_decoded_field(cache_dir / "svs5148_comp.png", "wind"),
    }

    hi_size = CANVAS_SIZE * SUPERSAMPLE
    yy, xx = np.mgrid[0:CANVAS_SIZE, 0:CANVAS_SIZE]
    ix_grid = xx.astype(np.float64) + 0.5
    iy_grid = yy.astype(np.float64) + 0.5

    for country in manifest["countries"]:
        cid = country["id"]
        min_lon, min_lat, max_lon, max_lat = [float(v) for v in country["bbox"]]

        mid_lat_rad = ((min_lat + max_lat) * 0.5) * math.pi / 180.0
        cos_lat = max(0.18, math.cos(mid_lat_rad))
        geo_w = max(0.05, (max_lon - min_lon) * cos_lat)
        geo_h = max(0.05, max_lat - min_lat)

        usable = float(CANVAS_SIZE) * (1.0 - 2.0 * MARGIN_RATIO)
        scale = usable / max(geo_w, geo_h)
        drawn_w = geo_w * scale
        drawn_h = geo_h * scale
        offset_x = (float(CANVAS_SIZE) - drawn_w) * 0.5
        offset_y = (float(CANVAS_SIZE) - drawn_h) * 0.5

        fill_hi = np.zeros((hi_size, hi_size), dtype=np.uint8)
        stroke_hi = np.zeros((hi_size, hi_size), dtype=np.uint8)

        all_rings_hi: list[np.ndarray] = []
        for poly in country["polygons"]:
            for ring in poly:
                if len(ring) < 3:
                    continue
                pts = np.array(ring, dtype=np.float64)
                px = (offset_x + (pts[:, 0] - min_lon) * cos_lat * scale) * SUPERSAMPLE
                py = (offset_y + (max_lat - pts[:, 1]) * scale) * SUPERSAMPLE
                ring_i32 = np.round(np.stack([px, py], axis=1)).astype(np.int32)
                all_rings_hi.append(ring_i32)

                single = np.zeros((hi_size, hi_size), dtype=np.uint8)
                cv2.fillPoly(single, [ring_i32], 255)
                fill_hi = cv2.bitwise_xor(fill_hi, single)

        if all_rings_hi:
            cv2.polylines(
                stroke_hi,
                all_rings_hi,
                isClosed=True,
                color=255,
                thickness=max(1, int(round(3.6 * SUPERSAMPLE))),
                lineType=cv2.LINE_AA,
            )

        fill_mask = cv2.resize(fill_hi, (CANVAS_SIZE, CANVAS_SIZE), interpolation=cv2.INTER_AREA)
        stroke_mask = cv2.resize(stroke_hi, (CANVAS_SIZE, CANVAS_SIZE), interpolation=cv2.INTER_AREA)

        lon_grid = min_lon + (ix_grid - offset_x) / (cos_lat * scale)
        lat_grid = max_lat - (iy_grid - offset_y) / scale

        country_dir = out_base_dir / cid
        country_dir.mkdir(parents=True, exist_ok=True)

        src_pixels_lon = max(6.0, ((max_lon - min_lon) / 360.0) * 2048.0)
        src_pixels_lat = max(6.0, ((max_lat - min_lat) / 180.0) * 1024.0)
        canvas_px_per_cell = float(max(drawn_w / src_pixels_lon, drawn_h / src_pixels_lat))

        inside_bool = fill_mask > 0
        strong_inside = fill_mask > 200

        sampled_layers: dict[str, np.ndarray] = {}
        for lid, _rgb in LAYER_SPECS:
            raw_canvas = np.zeros((CANVAS_SIZE, CANVAS_SIZE), dtype=np.float32)
            raw_canvas[inside_bool] = sample_bilinear_grid(
                fields[lid], lon_grid[inside_bool], lat_grid[inside_bool]
            )
            sampled_layers[lid] = raw_canvas

        for lid, (r_col, g_col, b_col) in LAYER_SPECS:
            sigma = (
                min(4.2, max(1.9, canvas_px_per_cell * 0.34))
                if lid == "melody"
                else min(16.0, max(2.8, canvas_px_per_cell * 0.85))
            )
            smoothed = smooth_canvas_field(sampled_layers[lid], fill_mask, sigma)

            sub_vals = smoothed[::8, ::8][strong_inside[::8, ::8]]
            if sub_vals.size > 0:
                p12 = float(np.percentile(sub_vals, 12))
                p98 = max(p12 + 0.08, float(np.percentile(sub_vals, 98)))
            else:
                p12, p98 = 0.0, 1.0

            if lid == "melody":
                final_int = np.minimum(1.0, np.power(np.minimum(1.0, smoothed * 1.32), 1.18))
            else:
                local_norm = np.clip((smoothed - p12) / (p98 - p12), 0.0, 1.0)
                final_int = smoothed * 0.50 + local_norm * 0.50

            data_alpha = photoshop_alpha(final_int, lid)
            border_alpha = (stroke_mask.astype(np.float32) / 255.0) * 122.0
            combined = np.maximum(data_alpha, border_alpha) * (fill_mask.astype(np.float32) / 255.0)
            final_a = np.where(inside_bool, np.clip(np.round(combined), 1, 235), 0).astype(np.uint8)

            bgra = np.zeros((CANVAS_SIZE, CANVAS_SIZE, 4), dtype=np.uint8)
            bgra[inside_bool, 0] = b_col
            bgra[inside_bool, 1] = g_col
            bgra[inside_bool, 2] = r_col
            bgra[:, :, 3] = final_a

            cv2.imwrite(str(country_dir / f"{lid}.png"), bgra)

        # Telemetry summary & initial meta.json (preserved/enriched by generate_country_audio.py)
        sub_mask = inside_bool[::4, ::4]
        n_samples = max(1, int(np.count_nonzero(sub_mask)))
        mean_temp01 = float(sampled_layers["temperature"][::4, ::4][sub_mask].sum() / n_samples)
        mean_co01 = float(sampled_layers["chords"][::4, ::4][sub_mask].sum() / n_samples)
        mean_nox01 = float(sampled_layers["bass"][::4, ::4][sub_mask].sum() / n_samples)
        mean_wind01 = float(sampled_layers["wind"][::4, ::4][sub_mask].sum() / n_samples)
        wind_speed_ms = round(3.2 + mean_wind01 * 18.5, 1)

        grid16_mask = strong_inside[::16, ::16]
        mel16 = sampled_layers["melody"][::16, ::16]
        lightning_cnt = int(np.count_nonzero(grid16_mask & (mel16 > 0.16)))

        meta_path = country_dir / "meta.json"
        existing_meta = {}
        if meta_path.exists():
            try:
                existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                existing_meta = {}

        meta_obj = {
            **existing_meta,
            "id": cid,
            "namePt": country["namePt"],
            "nameEn": country["nameEn"],
            "bbox": country["bbox"],
            "pngSpec": {
                "resolution": 1024,
                "marginRatio": MARGIN_RATIO,
                "layers": ["melody", "chords", "temperature", "bass", "wind"],
            },
            "telemetrySummary": {
                "lightningHotspotCount": lightning_cnt,
                "meanTemperature01": round(mean_temp01, 3),
                "meanCo01": round(mean_co01, 3),
                "meanNox01": round(mean_nox01, 3),
                "windMeanSpeedMs": wind_speed_ms,
            },
        }
        if "session" not in meta_obj:
            abs_lat = abs(float(country["lat"]))
            region_bpm = int(min(110, max(66, round(106.0 - abs_lat * 0.52 + (mean_temp01 - 0.5) * 12.0))))
            meta_obj["session"] = {
                "region": {
                    "bpm": region_bpm,
                    "keyRoot": "D",
                    "keyRootPt": "Ré",
                    "modeNamePt": "Dórico Atmosférico",
                    "modeNameEn": "Atmospheric Dorian",
                    "chords": ["Dm9", "Csus2", "Eb6", "Fadd9"],
                    "windMeanSpeed": wind_speed_ms,
                },
                "base": {
                    "bpm": 90,
                    "keyRoot": "A",
                    "keyRootPt": "Lá",
                    "modeNamePt": "Referência Neutra (90 BPM)",
                    "modeNameEn": "Neutral Reference (90 BPM)",
                    "chords": ["Am9", "Fmaj7", "Cmaj7", "Gsus4"],
                    "windMeanSpeed": wind_speed_ms,
                },
            }
        if "beatEvents" not in meta_obj:
            meta_obj["beatEvents"] = []

        meta_path.write_text(json.dumps(meta_obj, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            f"[PNG] Rendered {cid} ({country['namePt']}) — 5 PNGs (1024x1024 RGBA) + meta.json",
            flush=True,
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python render_country_layers.py <manifest.json>", file=sys.stderr)
        sys.exit(1)
    render_manifest(Path(sys.argv[1]))
