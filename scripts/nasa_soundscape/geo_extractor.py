"""
Geographic, physical-visual, and 2D spatial extractor resampled onto a common timeline
for the 5 global NASA videos (Earth Jukebox architecture).

Guaranteed principles:
  - Common temporal resampling: videos with different durations and FPS (e.g., 100s @ 60fps
    from ISS vs. 31s @ 12fps from GMAO) are projected onto the same canonical `total_bars` grid.
  - Optical flow (Farneback + temporal difference) computed per video in isolation.
  - Lightning (Melody): percentile-adaptive thresholds (with a minimum floor for true silence),
    connected components, refractory merging across neighboring frames keeping the peak frame,
    and a 2D annual persistence map for anchor notes.
  - NO2 (Bass) and CO (Chords): left-to-right spatial profiles per bar.
  - Wind (Effect): continuous series for speed, local contrast, dominant direction, and turbulence.
"""

from dataclasses import asdict, dataclass, field
import math
from pathlib import Path
import shutil
import subprocess
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np

from .config import ALL_LAYERS, BASE_DIR, VIDEO_FILES, GeoBoundingBox, normalize_layer_id


@dataclass
class SpatialFlashPoint:
    """Normalized 2D spatial point [0..1] within the crop."""
    x_norm: float
    y_norm: float
    intensity: float
    area_ratio: float = 0.0


@dataclass
class LightningEvent:
    """Discrete lightning event after spatial clustering and temporal refractory merging."""
    frame: int
    total_frames: int
    x_norm: float
    y_norm: float
    intensity: float
    area_ratio: float
    persistence: float = 0.0
    is_anchor: bool = False
    fused_frames: int = 1

    def to_dict(self) -> dict:
        return {
            "frame": int(self.frame),
            "total_frames": int(self.total_frames),
            "x_norm": round(float(self.x_norm), 4),
            "y_norm": round(float(self.y_norm), 4),
            "intensity": round(float(self.intensity), 4),
            "area_ratio": round(float(self.area_ratio), 5),
            "persistence": round(float(self.persistence), 4),
            "is_anchor": bool(self.is_anchor),
            "fused_frames": int(self.fused_frames),
        }


@dataclass
class LayerFeatures:
    """Metrics and control curves derived EXCLUSIVELY from this layer's video."""
    layer_id: str
    video_file: str
    source_duration_sec: float
    source_fps: float
    analysis_frames: int
    mean_index: float
    peak_index: float
    spatial_contrast: float
    temporal_variation: float
    active_area_ratio: float
    time_series: List[float]
    contour_series: List[float]
    slot_hotspots: List[SpatialFlashPoint]
    raw_rgb_mean: Tuple[float, float, float]
    motion_mean: float = 0.0
    motion_series: List[float] = field(default_factory=list)
    scan_windows: List[dict] = field(default_factory=list)
    bar_column_profiles: List[List[dict]] = field(default_factory=list)
    lightning_events: List[LightningEvent] = field(default_factory=list)
    persistence_hotspots: List[dict] = field(default_factory=list)
    adaptive_thresholds: Dict[str, float] = field(default_factory=dict)
    frame_yellow_bursts: List[dict] = field(default_factory=list)
    wind_orientation: float = 0.0
    wind_local_contrast: float = 0.0
    wind_turbulence: float = 0.0
    wind_orientation_series: List[float] = field(default_factory=list)
    wind_contrast_series: List[float] = field(default_factory=list)
    wind_turbulence_series: List[float] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "layer_id": self.layer_id,
            "video_file": self.video_file,
            "source_duration_sec": round(self.source_duration_sec, 3),
            "source_fps": round(self.source_fps, 2),
            "analysis_frames": int(self.analysis_frames),
            "mean_index": round(self.mean_index, 4),
            "peak_index": round(self.peak_index, 4),
            "spatial_contrast": round(self.spatial_contrast, 4),
            "temporal_variation": round(self.temporal_variation, 4),
            "active_area_ratio": round(self.active_area_ratio, 4),
            "motion_mean": round(self.motion_mean, 4),
            "wind_orientation": round(self.wind_orientation, 4),
            "wind_local_contrast": round(self.wind_local_contrast, 4),
            "wind_turbulence": round(self.wind_turbulence, 4),
            "time_series": [round(v, 4) for v in self.time_series],
            "contour_series": [round(v, 4) for v in self.contour_series],
            "motion_series": [round(v, 4) for v in self.motion_series],
            "wind_orientation_series": [round(v, 4) for v in self.wind_orientation_series],
            "wind_contrast_series": [round(v, 4) for v in self.wind_contrast_series],
            "wind_turbulence_series": [round(v, 4) for v in self.wind_turbulence_series],
            "slot_hotspots": [
                {
                    "x_norm": round(p.x_norm, 4),
                    "y_norm": round(p.y_norm, 4),
                    "intensity": round(p.intensity, 4),
                    "area_ratio": round(p.area_ratio, 5),
                }
                for p in self.slot_hotspots
            ],
            "scan_windows": self.scan_windows,
            "bar_column_profiles": self.bar_column_profiles,
            "lightning_events": [ev.to_dict() for ev in self.lightning_events],
            "persistence_hotspots": self.persistence_hotspots,
            "adaptive_thresholds": {k: round(float(v), 5) for k, v in self.adaptive_thresholds.items()},
            "frame_yellow_bursts": self.frame_yellow_bursts,
            "raw_rgb_mean": tuple(round(c, 1) for c in self.raw_rgb_mean),
        }


@dataclass
class SynchronizedLayerStream:
    """Stream of frames resampled onto the canonical timeline + decoded physical fields."""
    features: LayerFeatures
    frames_bgr: List[np.ndarray]
    fields_norm: List[np.ndarray]
    frame_hotspots: List[SpatialFlashPoint]
    persistence_grid: Optional[np.ndarray] = None


def bbox_to_pixels(bbox: GeoBoundingBox, width: int, height: int) -> Tuple[int, int, int, int]:
    """Converts a bounding box (lat/lon) to pixel coordinates (x0, x1, y0, y1)."""
    b = bbox.validate()
    x0 = int(round(((b.lon_min + 180.0) / 360.0) * width))
    x1 = int(round(((b.lon_max + 180.0) / 360.0) * width))
    y0 = int(round(((90.0 - b.lat_max) / 180.0) * height))
    y1 = int(round(((90.0 - b.lat_min) / 180.0) * height))

    x0 = max(0, min(width - 2, x0))
    x1 = max(x0 + 2, min(width, x1))
    y0 = max(0, min(height - 2, y0))
    y1 = max(y0 + 2, min(height, y1))
    return x0, x1, y0, y1


def build_hud_valid_mask(
    width: int, height: int, x0: int, x1: int, y0: int, y1: int, has_gmao_hud: bool
) -> np.ndarray:
    """Discards NASA GMAO logo/timestamp overlays in the left corners if they intersect."""
    mask = np.ones((y1 - y0, x1 - x0), dtype=bool)
    if not has_gmao_hud:
        return mask

    logo_x, logo_y = int(0.175 * width), int(0.075 * height)
    if x0 < logo_x and y0 < logo_y:
        mx1 = min(x1, logo_x) - x0
        my1 = min(y1, logo_y) - y0
        mask[:my1, :mx1] = False

    ts_x, ts_y = int(0.250 * width), int(0.910 * height)
    if x0 < ts_x and y1 > ts_y:
        mx1 = min(x1, ts_x) - x0
        my0 = max(y0, ts_y) - y0
        mask[my0:, :mx1] = False

    if not mask.any():
        mask[:] = True
    return mask


# ============================================================================
# Heuristic decoders calibrated to each NASA video's visual palette
# ============================================================================

def decode_temperature_map(rgb: np.ndarray, center_lat: float) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32) / 255.0
    g = rgb[..., 1].astype(np.float32) / 255.0
    b = rgb[..., 2].astype(np.float32) / 255.0

    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    chroma = cmax - cmin

    idx = np.full(r.shape, 0.5, dtype=np.float32)

    warm_mask = (r > g) & (g >= b * 0.85) & (chroma >= 0.08)
    warm_ratio = np.clip(1.0 - (g / np.maximum(r, 1e-4)), 0.0, 1.0)
    idx = np.where(warm_mask, 0.60 + 0.33 * warm_ratio, idx)

    temp_mask = (g >= r) & (g >= b) & (chroma >= 0.08)
    rb_balance = np.clip((r - b + 1.0) * 0.5, 0.0, 1.0)
    idx = np.where(temp_mask, 0.36 + 0.26 * rb_balance, idx)

    cold_mask = (b > g) & (~warm_mask) & (chroma >= 0.08)
    purple_factor = np.clip((r - g) / np.maximum(b, 1e-4), 0.0, 1.0)
    blue_cool = np.clip(g / np.maximum(b, 1e-4), 0.0, 1.0)
    cold_val = 0.16 + 0.20 * blue_cool - 0.10 * purple_factor
    idx = np.where(cold_mask, np.clip(cold_val, 0.04, 0.36), idx)

    achrom_mask = chroma < 0.08
    if abs(center_lat) < 36.0:
        idx = np.where(achrom_mask, 0.94, idx)
    else:
        idx = np.where(achrom_mask, 0.05, idx)

    return np.clip(idx, 0.0, 1.0)


def decode_wind_map(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32) / 255.0
    g = rgb[..., 1].astype(np.float32) / 255.0
    b = rgb[..., 2].astype(np.float32) / 255.0

    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    chroma = cmax - cmin

    activity = np.clip((chroma - 0.06) / 0.45, 0.0, 1.0)
    cyan_shift = np.clip(g / np.maximum(b, 1e-4), 0.0, 1.2)
    storm_warmth = np.clip((r - b) + 0.5 * g, 0.0, 1.0)

    spectral_speed = np.where(
        b >= r,
        0.28 + 0.36 * np.clip(cyan_shift, 0.0, 1.0),
        0.72 + 0.28 * storm_warmth,
    )

    wind_idx = 0.05 + activity * spectral_speed
    return np.clip(wind_idx, 0.0, 1.0)


def decode_co_map(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    raw_co = np.clip((238.0 - g) / 230.0, 0.0, 1.0)
    valid_tint = r > 45.0
    return np.where(valid_tint, raw_co, 0.35).astype(np.float32)


def decode_no2_map(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)

    green_excess = g - 0.5 * (r + b)
    is_green = green_excess > 8.0

    pastel_to_pure = np.clip((130.0 - 0.5 * (r + b)) / 130.0, 0.0, 1.0)
    urban_darkening = np.clip((155.0 - g) / 105.0, 0.0, 1.0)

    green_no2 = 0.10 + 0.34 * pastel_to_pure + 0.54 * urban_darkening
    achromatic_no2 = 0.04 * np.clip(g / 255.0, 0.0, 1.0)

    return np.clip(np.where(is_green, green_no2, achromatic_no2), 0.0, 1.0).astype(np.float32)


def decode_lightning_map(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)

    yellow_glow = np.clip((0.5 * (r + g) - b - 5.0) / 150.0, 0.0, 1.0)
    bright_flash = np.clip((np.minimum(r, g) - 165.0) / 90.0, 0.0, 1.0)
    return np.clip(np.maximum(yellow_glow, bright_flash), 0.0, 1.0).astype(np.float32)


def decode_layer_field(layer_id: str, rgb: np.ndarray, center_lat: float) -> np.ndarray:
    cid = normalize_layer_id(layer_id)
    if cid == "temperature":
        return decode_temperature_map(rgb, center_lat)
    if cid == "wind":
        return decode_wind_map(rgb)
    if cid == "chords":
        return decode_co_map(rgb)
    if cid == "bass":
        return decode_no2_map(rgb)
    if cid == "melody":
        return decode_lightning_map(rgb)
    raise ValueError(f"Camada desconhecida: {layer_id}")


# ============================================================================
# Spatial Analysis, Isolated Optical Flow, and Adaptive Lightning Extraction
# ============================================================================

def _find_frame_hotspot(
    layer_id: str,
    field: np.ndarray,
    prev_field: Optional[np.ndarray],
    valid_mask: np.ndarray,
) -> SpatialFlashPoint:
    cid = normalize_layer_id(layer_id)
    h, w = field.shape[:2]
    masked = np.where(valid_mask, field, 0.0).astype(np.float32)

    if cid == "melody":
        if prev_field is not None and prev_field.shape == field.shape:
            transient = np.maximum(0.0, masked - np.where(valid_mask, prev_field, 0.0))
            score_map = 0.45 * masked + 0.85 * transient
        else:
            score_map = masked

        blurred = cv2.GaussianBlur(score_map, (5, 5), 0)
        max_val = float(blurred.max())
        if max_val > 0.04:
            py, px = np.unravel_index(int(np.argmax(blurred)), blurred.shape)
            return SpatialFlashPoint(
                x_norm=float((px + 0.5) / max(1, w)),
                y_norm=float((py + 0.5) / max(1, h)),
                intensity=float(np.clip(masked[py, px], 0.0, 1.0)),
            )
        return SpatialFlashPoint(x_norm=0.5, y_norm=0.5, intensity=float(masked.max()))

    blurred = cv2.GaussianBlur(masked, (9, 9), 0)
    valid_vals = blurred[valid_mask]
    if valid_vals.size == 0 or float(valid_vals.max()) < 1e-4:
        return SpatialFlashPoint(x_norm=0.5, y_norm=0.5, intensity=0.0)

    thresh = float(np.percentile(valid_vals, 82))
    weights = np.maximum(0.0, blurred - thresh + 1e-3) * valid_mask.astype(np.float32)
    w_sum = float(weights.sum())
    if w_sum <= 1e-6:
        py, px = np.unravel_index(int(np.argmax(blurred)), blurred.shape)
        return SpatialFlashPoint(
            x_norm=float((px + 0.5) / max(1, w)),
            y_norm=float((py + 0.5) / max(1, h)),
            intensity=float(blurred[py, px]),
        )

    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx = float((weights * (xs + 0.5)).sum() / (w_sum * max(1, w)))
    cy = float((weights * (ys + 0.5)).sum() / (w_sum * max(1, h)))
    peak_v = float(np.percentile(valid_vals, 95))
    return SpatialFlashPoint(
        x_norm=float(np.clip(cx, 0.04, 0.96)),
        y_norm=float(np.clip(cy, 0.04, 0.96)),
        intensity=float(np.clip(peak_v, 0.0, 1.0)),
    )


def _compute_frame_motion(
    field: np.ndarray,
    prev_field: Optional[np.ndarray],
    valid_mask: np.ndarray,
) -> float:
    """Farneback optical flow + frame difference restricted ONLY to this video."""
    if prev_field is None or prev_field.shape != field.shape:
        return 0.0
    diff = float(np.abs(field - prev_field)[valid_mask].mean()) if valid_mask.any() else 0.0
    small_prev = cv2.resize(
        np.clip(prev_field * 255.0, 0, 255).astype(np.uint8), (96, 66), interpolation=cv2.INTER_AREA
    )
    small_curr = cv2.resize(
        np.clip(field * 255.0, 0, 255).astype(np.uint8), (96, 66), interpolation=cv2.INTER_AREA
    )
    flow = cv2.calcOpticalFlowFarneback(
        small_prev,
        small_curr,
        None,
        pyr_scale=0.5,
        levels=2,
        winsize=9,
        iterations=2,
        poly_n=5,
        poly_sigma=1.1,
        flags=0,
    )
    mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
    flow_score = float(np.clip(np.percentile(mag, 85) / 2.5, 0.0, 1.0))
    diff_score = float(np.clip(diff * 18.0, 0.0, 1.0))
    return float(np.clip(0.55 * flow_score + 0.45 * diff_score, 0.0, 1.0))


def _compute_wind_frame_metrics(
    field: np.ndarray,
    prev_field: Optional[np.ndarray],
    valid_mask: np.ndarray,
) -> Tuple[float, float, float]:
    """
    Extracts dominant direction [-1..1], local contrast [0..1], and instantaneous turbulence [0..1]
    exclusively from the wind map.
    """
    masked = np.where(valid_mask, field, 0.0).astype(np.float32)
    gx = cv2.Sobel(masked, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(masked, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)
    if valid_mask.any():
        w_mag = mag[valid_mask]
        vx = float((-gy[valid_mask] * w_mag).sum())
        vy = float((gx[valid_mask] * w_mag).sum())
        norm = math.hypot(vx, vy)
        orient_bias = float(np.clip(vx / max(1e-5, norm), -1.0, 1.0)) if norm > 1e-4 else 0.0
        curl_like = float(np.clip(np.percentile(w_mag, 85) * 1.4, 0.0, 1.0)) if w_mag.size else 0.0
    else:
        orient_bias = 0.0
        curl_like = 0.0

    h, w = masked.shape
    ys = np.linspace(0, h, 5, dtype=int)
    xs = np.linspace(0, w, 5, dtype=int)
    block_stds: List[float] = []
    for r in range(4):
        for c in range(4):
            m_blk = valid_mask[ys[r] : ys[r + 1], xs[c] : xs[c + 1]]
            if m_blk.any():
                vals = masked[ys[r] : ys[r + 1], xs[c] : xs[c + 1]][m_blk]
                block_stds.append(float(vals.std()))
    local_contrast = float(np.clip(np.mean(block_stds) * 4.0, 0.0, 1.0)) if block_stds else 0.0

    if prev_field is not None and prev_field.shape == field.shape and valid_mask.any():
        temp_diff = float(np.clip(np.abs(field - prev_field)[valid_mask].mean() * 20.0, 0.0, 1.0))
    else:
        temp_diff = 0.0
    turbulence = float(np.clip(0.45 * temp_diff + 0.35 * curl_like + 0.20 * local_contrast, 0.0, 1.0))
    return orient_bias, local_contrast, turbulence


def _extract_lightning_events_and_persistence(
    fields_norm: List[np.ndarray],
    valid_mask: List[np.ndarray] | np.ndarray,
    total_bars: int = 8,
) -> Tuple[List[LightningEvent], np.ndarray, List[dict], Dict[str, float], List[dict]]:
    """
    Extracts discrete lightning events with:
      1. Inter-frame transient + brightness.
      2. Percentile-adaptive thresholds per video/crop (with a minimum floor for true silence).
      3. Connected components (discarding micro-noise).
      4. Temporal refractory period: merges blobs at the same position in neighboring frames, keeping the peak.
      5. 2D annual persistence map across the whole video: identifies persistent regions (anchor notes).
      6. Frame-by-frame physical count of visible yellow dots (`frame_yellow_bursts`) for
         real-time opening of harmonic doublings (5th/8th) and high crystalline sparkle.
    """
    grid_h, grid_w = 24, 32
    empty_grid = np.zeros((grid_h, grid_w), dtype=np.float32)
    n_frames = len(fields_norm)
    if n_frames == 0:
        return [], empty_grid, [], {"pixel_thresh": 0.08, "peak_thresh": 0.10, "min_area_px": 4.0}, []

    h, w = fields_norm[0].shape[:2]
    valid_area = float(max(1, int(valid_mask.sum())))

    # 1. Remove nighttime city lights (present in ~30-50% of frames as the ISS day/night
    #    terminator passes -> captured by the per-pixel 88th temporal percentile), preserving
    #    real lightning flashes (brief impulsive events glowing for only a few frames).
    masked_stack = np.stack(
        [np.where(valid_mask, f, 0.0).astype(np.float32) for f in fields_norm], axis=0
    )
    if n_frames >= 6:
        static_bg = np.percentile(masked_stack, 88.0, axis=0).astype(np.float32)
    else:
        static_bg = np.zeros((h, w), dtype=np.float32)

    dynamic_stack = np.maximum(0.0, masked_stack - static_bg * 1.15 - 0.03)
    global_max = float(dynamic_stack.max())
    empty_bursts = [{"dot_count": 0, "yellow_density": 0.0, "top_points": []} for _ in range(n_frames)]

    # Absolute silence floor: zeroed/masked video or only static lights -> zero events!
    if global_max < 0.075:
        return [], empty_grid, [], {"pixel_thresh": 0.08, "peak_thresh": 0.10, "min_area_px": 4.0}, empty_bursts

    score_maps: List[np.ndarray] = []
    masked_fields: List[np.ndarray] = []
    frame_yellow_bursts: List[dict] = []
    dot_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    prev_dyn: Optional[np.ndarray] = None

    for f_idx in range(n_frames):
        dyn = dynamic_stack[f_idx]
        masked_fields.append(dyn)
        if prev_dyn is not None:
            transient = np.maximum(0.0, dyn - prev_dyn)
            s_map = 0.35 * dyn + 0.85 * transient
        else:
            s_map = 0.65 * dyn
        blurred = cv2.GaussianBlur(s_map, (5, 5), 0)
        score_maps.append(blurred)
        prev_dyn = dyn

        # Cross-region comparable physical measurement: lit yellow dots in this exact frame (dyn >= 0.13)
        y_u8 = ((dyn >= 0.13) & valid_mask).astype(np.uint8)
        if y_u8.any():
            y_closed = cv2.morphologyEx(y_u8, cv2.MORPH_CLOSE, dot_kernel)
            n_lbl, lbls, st_cc, cents = cv2.connectedComponentsWithStats(y_closed, connectivity=8)
            pts_frame: List[Tuple[float, int, float, float]] = []
            dot_cnt = 0
            for k_l in range(1, n_lbl):
                a_px = int(st_cc[k_l, cv2.CC_STAT_AREA])
                if a_px < 1:
                    continue
                dot_cnt += 1
                pk_v = float(np.clip(dyn[lbls == k_l].max(), 0.0, 1.0))
                cx_f, cy_f = cents[k_l]
                pts_frame.append(
                    (
                        round(pk_v, 5),
                        a_px,
                        round(float(np.clip((cx_f + 0.5) / max(1, w), 0.02, 0.98)), 4),
                        round(float(np.clip((cy_f + 0.5) / max(1, h), 0.02, 0.98)), 4),
                    )
                )
            pts_frame.sort(reverse=True)
            # Physical scale: <=12 dots = 0.0 (pure); 13..48 = 5th/8th weight; 49..165+ = crystalline sparkle
            y_dens = float(np.clip((dot_cnt - 12.0) / 145.0, 0.0, 1.0))
            frame_yellow_bursts.append(
                {
                    "dot_count": int(dot_cnt),
                    "yellow_density": round(y_dens, 4),
                    "top_points": [
                        {"x_norm": p[2], "y_norm": p[3], "intensity": round(p[0], 4)}
                        for p in pts_frame[:5]
                    ],
                }
            )
        else:
            frame_yellow_bursts.append({"dot_count": 0, "yellow_density": 0.0, "top_points": []})

    # 2. Percentile-adaptive thresholds on real transient pixels in the crop
    active_samples = (
        np.concatenate(
            [sm[valid_mask & (sm > 0.04)] for sm in score_maps if np.any(valid_mask & (sm > 0.04))]
        )
        if any(np.any(valid_mask & (sm > 0.04)) for sm in score_maps)
        else np.zeros(0, dtype=np.float32)
    )

    if active_samples.size == 0:
        return [], empty_grid, [], {"pixel_thresh": 0.08, "peak_thresh": 0.10, "min_area_px": 4.0}, frame_yellow_bursts

    p_val = float(np.percentile(active_samples, 78.0))
    pix_thresh = float(np.clip(p_val, 0.075, 0.24))
    peak_thresh = float(np.clip(pix_thresh * 1.20, 0.095, 0.28))
    min_area = max(3, min(10, int(round(0.00008 * valid_area))))

    # 3. Connected components in each frame
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    raw_blobs: List[LightningEvent] = []

    for f_idx, (s_map, m_field) in enumerate(zip(score_maps, masked_fields)):
        if float(s_map.max()) < pix_thresh:
            continue
        active_u8 = ((s_map >= pix_thresh) & valid_mask).astype(np.uint8)
        clustered_u8 = cv2.morphologyEx(active_u8, cv2.MORPH_CLOSE, kernel)
        n_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(clustered_u8, connectivity=8)
        for lbl in range(1, n_labels):
            area = int(stats[lbl, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            comp_mask = labels == lbl
            pk_int = float(np.clip(m_field[comp_mask].max(), 0.0, 1.0))
            if pk_int < peak_thresh:
                continue
            cx, cy = centroids[lbl]
            raw_blobs.append(
                LightningEvent(
                    frame=f_idx,
                    total_frames=n_frames,
                    x_norm=float(np.clip((cx + 0.5) / max(1, w), 0.02, 0.98)),
                    y_norm=float(np.clip((cy + 0.5) / max(1, h), 0.02, 0.98)),
                    intensity=pk_int,
                    area_ratio=float(area / valid_area),
                )
            )

    if not raw_blobs:
        return [], empty_grid, [], {
            "pixel_thresh": pix_thresh,
            "peak_thresh": peak_thresh,
            "min_area_px": float(min_area),
        }, frame_yellow_bursts

    # 4. Refractory merging across neighboring frames at the same position, keeping the peak frame
    frames_per_bar = max(2, n_frames // max(1, total_bars))
    refractory_frames = max(2, frames_per_bar // 6)
    spatial_merge_radius = 0.065

    # Sort from strongest to weakest peak (deterministic tie-breaker by coordinate/frame)
    raw_blobs.sort(
        key=lambda ev: (
            round(ev.intensity * math.sqrt(max(1e-5, ev.area_ratio)), 6),
            round(ev.intensity, 6),
            -ev.frame,
            round(ev.x_norm, 4),
        ),
        reverse=True,
    )

    fused_events: List[LightningEvent] = []
    for cand in raw_blobs:
        merged_into: Optional[LightningEvent] = None
        for ex in fused_events:
            if abs(cand.frame - ex.frame) <= refractory_frames:
                if math.hypot(cand.x_norm - ex.x_norm, cand.y_norm - ex.y_norm) <= spatial_merge_radius:
                    merged_into = ex
                    break
        if merged_into is not None:
            merged_into.area_ratio = max(merged_into.area_ratio, cand.area_ratio)
            merged_into.fused_frames += 1
        else:
            fused_events.append(cand)

    # Sort chronologically
    fused_events.sort(key=lambda ev: (ev.frame, ev.x_norm, ev.y_norm))

    # 5. Annual persistence map (accumulates all events across the entire video)
    yy, xx = np.mgrid[0:grid_h, 0:grid_w].astype(np.float32)
    xx_norm = (xx + 0.5) / grid_w
    yy_norm = (yy + 0.5) / grid_h
    pers_grid = np.zeros((grid_h, grid_w), dtype=np.float32)

    for ev in fused_events:
        weight = ev.intensity * (0.45 + math.sqrt(max(1e-4, ev.area_ratio * 25.0)))
        dist2 = ((xx_norm - ev.x_norm) ** 2 + (yy_norm - ev.y_norm) ** 2) / (2.0 * (0.065 ** 2))
        pers_grid += weight * np.exp(-dist2)

    if float(pers_grid.max()) > 1e-6:
        pers_grid /= float(pers_grid.max())

    # Score each event with the persistence of its geographic region
    pers_scores: List[float] = []
    for ev in fused_events:
        gx_i = min(grid_w - 1, max(0, int(ev.x_norm * grid_w)))
        gy_i = min(grid_h - 1, max(0, int(ev.y_norm * grid_h)))
        ev.persistence = float(pers_grid[gy_i, gx_i])
        pers_scores.append(ev.persistence)

    anchor_thresh = max(0.64, float(np.percentile(pers_scores, 82.0))) if len(pers_scores) >= 4 else 0.72
    for ev in fused_events:
        ev.is_anchor = bool(ev.persistence >= anchor_thresh and len(fused_events) >= 3)

    # Extract up to 4 dominant persistent centers for manifest/diagnostics
    persistence_hotspots: List[dict] = []
    temp_grid = pers_grid.copy()
    for _ in range(4):
        pk = float(temp_grid.max())
        if pk < 0.45:
            break
        py, px = np.unravel_index(int(np.argmax(temp_grid)), temp_grid.shape)
        hx = float((px + 0.5) / grid_w)
        hy = float((py + 0.5) / grid_h)
        persistence_hotspots.append(
            {"x_norm": round(hx, 4), "y_norm": round(hy, 4), "persistence": round(pk, 4)}
        )
        sup_mask = ((xx_norm - hx) ** 2 + (yy_norm - hy) ** 2) <= (0.14 ** 2)
        temp_grid[sup_mask] = 0.0

    thresholds_info = {
        "pixel_thresh": pix_thresh,
        "peak_thresh": peak_thresh,
        "min_area_px": float(min_area),
        "anchor_persistence_thresh": anchor_thresh,
    }
    return fused_events, pers_grid, persistence_hotspots, thresholds_info, frame_yellow_bursts


def _compute_scan_windows(
    fields_norm: List[np.ndarray],
    valid_mask: np.ndarray,
    num_windows: int = 16,
    layer_id: str = "chords",
) -> List[dict]:
    """Scans the map left->right synchronized to video time in `num_windows` steps."""
    if not fields_norm:
        return []
    h, w = fields_norm[0].shape[:2]
    edges = np.linspace(0, len(fields_norm), num_windows + 1, dtype=int)
    half_win = max(6, int(round(0.11 * w)))
    windows: List[dict] = []

    for idx in range(num_windows):
        f0 = int(edges[idx])
        f1 = max(f0 + 1, int(edges[idx + 1]))
        x_center_norm = (idx + 0.5) / float(num_windows)
        cx_px = int(round(x_center_norm * w))
        wx0 = max(0, cx_px - half_win)
        wx1 = min(w, cx_px + half_win)

        col_mask = valid_mask[:, wx0:wx1]
        if not col_mask.any():
            col_mask = np.ones((h, max(1, wx1 - wx0)), dtype=bool)

        sub_fields = [f[:, wx0:wx1] for f in fields_norm[f0:f1]]
        col_vals = [sf[col_mask] for sf in sub_fields]
        w_mean = float(np.mean([v.mean() for v in col_vals]))
        w_peak = float(np.max([np.percentile(v, 95) for v in col_vals]))
        w_contrast = float(np.clip(np.mean([v.std() for v in col_vals]) * 3.2, 0.0, 1.0))
        if len(sub_fields) > 1:
            diffs = [
                float(np.abs(sub_fields[k] - sub_fields[k - 1])[col_mask].mean())
                for k in range(1, len(sub_fields))
            ]
            w_temp_var = float(np.clip(np.mean(diffs) * 24.0, 0.0, 1.0))
        else:
            w_temp_var = 0.0

        mid_field = fields_norm[(f0 + f1) // 2]
        win_mask_full = np.zeros_like(valid_mask, dtype=bool)
        win_mask_full[:, wx0:wx1] = valid_mask[:, wx0:wx1]
        spot = _find_frame_hotspot(layer_id, mid_field, None, win_mask_full if win_mask_full.any() else valid_mask)

        windows.append(
            {
                "window_idx": idx,
                "x_center": round(x_center_norm, 4),
                "mean": round(float(np.clip(w_mean, 0.0, 1.0)), 4),
                "peak": round(float(np.clip(w_peak, 0.0, 1.0)), 4),
                "contrast": round(w_contrast, 4),
                "temporal_var": round(w_temp_var, 4),
                "x_norm": round(spot.x_norm, 4),
                "y_norm": round(spot.y_norm, 4),
            }
        )
    return windows


def _compute_bar_column_profiles(
    fields_norm: List[np.ndarray],
    valid_mask: np.ndarray,
    total_bars: int = 8,
    cols_per_bar: int = 8,
) -> List[List[dict]]:
    """
    For each bar (temporal slice of the video), scans the crop left-to-right
    in `cols_per_bar` columns (e.g., 8 eighth-notes), measuring mean level, urban peak (p95),
    spatial contrast, and vertical Y centroid.
    """
    if not fields_norm:
        return []
    h, w = fields_norm[0].shape[:2]
    bar_edges = np.linspace(0, len(fields_norm), total_bars + 1, dtype=int)
    col_edges = np.linspace(0, w, cols_per_bar + 1, dtype=int)
    bars_out: List[List[dict]] = []

    for b in range(total_bars):
        f0 = int(bar_edges[b])
        f1 = max(f0 + 1, int(bar_edges[b + 1]))
        bar_field = np.mean(fields_norm[f0:f1], axis=0).astype(np.float32)

        cols: List[dict] = []
        prev_mean: Optional[float] = None
        for c in range(cols_per_bar):
            cx0 = int(col_edges[c])
            cx1 = max(cx0 + 1, int(col_edges[c + 1]))
            cmask = valid_mask[:, cx0:cx1]
            cvals = bar_field[:, cx0:cx1][cmask] if cmask.any() else bar_field[:, cx0:cx1].ravel()

            c_mean = float(np.clip(cvals.mean(), 0.0, 1.0)) if cvals.size else 0.0
            c_peak = float(np.clip(np.percentile(cvals, 95), 0.0, 1.0)) if cvals.size else 0.0
            c_std = float(np.clip(cvals.std() * 3.8, 0.0, 1.0)) if cvals.size else 0.0
            grad_x = (c_mean - prev_mean) if prev_mean is not None else 0.0
            prev_mean = c_mean

            col_prof = bar_field[:, cx0:cx1].mean(axis=1)
            hy = float((int(np.argmax(col_prof)) + 0.5) / max(1, h))
            hx = float((0.5 * (cx0 + cx1)) / max(1, w))

            cols.append(
                {
                    "col": c,
                    "x_norm": round(hx, 4),
                    "y_norm": round(hy, 4),
                    "mean": round(c_mean, 4),
                    "peak": round(c_peak, 4),
                    "contrast": round(c_std, 4),
                    "grad_x": round(grad_x, 4),
                }
            )
        bars_out.append(cols)
    return bars_out


# ============================================================================
# Decoding and Common Temporal Resampling of Any Video
# ============================================================================

def _decode_video_resampled_tiles(
    video_path: Path,
    bbox: GeoBoundingBox,
    num_target_frames: int,
    tile_size: Tuple[int, int] = (384, 264),
    time_start_sec: Optional[float] = None,
    window_span_sec: Optional[float] = None,
    blend_frames: bool = True,
) -> Tuple[List[np.ndarray], np.ndarray, float, float]:
    """
    Resamples any video (regardless of duration or native FPS) to exactly
    `num_target_frames` uniformly distributed frames on the common timeline.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Não foi possível abrir o vídeo: {video_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 12.0)
    total_src_frames = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
    src_duration_sec = total_src_frames / max(1e-3, src_fps)

    x0, x1, y0, y1 = bbox_to_pixels(bbox, width, height)
    cw, ch = x1 - x0, y1 - y0
    tile_w, tile_h = tile_size

    # Define temporal window: by default uses 100% of video duration (full annual evolution)
    if time_start_sec is not None and window_span_sec is not None and window_span_sec > 0:
        # Proportional scaling if the video has a different duration from the 31s reference
        start_norm = float(np.clip(time_start_sec / 31.0, 0.0, 0.90))
        span_norm = float(np.clip(window_span_sec / 31.0, 0.08, 1.0 - start_norm))
        actual_start = start_norm * src_duration_sec
        actual_span = span_norm * src_duration_sec
    else:
        actual_start = 0.0
        actual_span = src_duration_sec

    ffmpeg_bin = shutil.which("ffmpeg")
    raw_frames: List[np.ndarray] = []

    if ffmpeg_bin:
        cap.release()
        scale_flag = "area" if cw > tile_w else "bilinear"
        is_huge_4k = (total_src_frames > 1500 and width >= 3000 and actual_span > 40.0)

        if is_huge_4k:
            # Fast multithreaded 1Hz keyframe extraction from the ISS 4K 60fps video (~101 frames covering 100s)
            vf_chain = f"crop={cw}:{ch}:{x0}:{y0},scale={tile_w}:{tile_h}:flags={scale_flag}"
            cmd = [
                ffmpeg_bin,
                "-hide_banner",
                "-loglevel",
                "error",
                "-threads",
                "0",
                "-skip_frame",
                "nokey",
                "-i",
                str(video_path),
                "-vf",
                vf_chain,
                "-vsync",
                "vfr",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "bgr24",
                "-",
            ]
        else:
            eff_fps = max(1.0, num_target_frames / max(0.5, actual_span))
            vf_chain = f"crop={cw}:{ch}:{x0}:{y0},scale={tile_w}:{tile_h}:flags={scale_flag},fps={eff_fps:.5f}"
            cmd = [
                ffmpeg_bin,
                "-hide_banner",
                "-loglevel",
                "error",
                "-threads",
                "0",
                "-ss",
                f"{actual_start:.3f}",
                "-t",
                f"{actual_span:.3f}",
                "-i",
                str(video_path),
                "-vf",
                vf_chain,
                "-f",
                "rawvideo",
                "-pix_fmt",
                "bgr24",
                "-",
            ]

        try:
            out_bytes = subprocess.check_output(cmd, stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            frame_bytes = tile_w * tile_h * 3
            n_got = len(out_bytes) // frame_bytes
            if n_got >= 4:
                arr = np.frombuffer(out_bytes[: n_got * frame_bytes], dtype=np.uint8).reshape(
                    (n_got, tile_h, tile_w, 3)
                )
                raw_frames = [arr[i].copy() for i in range(n_got)]
        except Exception:
            raw_frames = []

    if not raw_frames:
        cap = cv2.VideoCapture(str(video_path))
        f_start = max(0, min(total_src_frames - 1, int(round(actual_start * src_fps))))
        f_end = max(f_start, min(total_src_frames - 1, int(round((actual_start + actual_span) * src_fps))))
        desired = set(int(i) for i in np.linspace(f_start, f_end, min(num_target_frames, f_end - f_start + 1), dtype=int))
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_start)
        interp = cv2.INTER_AREA if cw > tile_w else cv2.INTER_LINEAR
        for cur_f in range(f_start, f_end + 1):
            if not cap.grab():
                break
            if cur_f not in desired:
                continue
            ok, frame_bgr = cap.retrieve()
            if ok and frame_bgr is not None:
                crop = frame_bgr[y0:y1, x0:x1]
                raw_frames.append(cv2.resize(crop, (tile_w, tile_h), interpolation=interp))
        cap.release()

    if not raw_frames:
        raise RuntimeError(f"Nenhum quadro pôde ser decodificado de {video_path}")

    # Resample to exact `num_target_frames` frames on the common timeline
    n_src = len(raw_frames)
    resampled: List[np.ndarray] = []
    if n_src == num_target_frames:
        resampled = raw_frames
    elif not blend_frames:
        # Preserve sharp flash transients (no artificial cross-blend between frames)
        idxs = np.round(np.linspace(0, n_src - 1, num_target_frames)).astype(int)
        resampled = [raw_frames[int(k)] for k in idxs]
    else:
        for i in range(num_target_frames):
            pos = (i / max(1, num_target_frames - 1)) * (n_src - 1)
            lo = int(math.floor(pos))
            hi = min(n_src - 1, lo + 1)
            frac = pos - lo
            if lo == hi or frac < 0.02:
                resampled.append(raw_frames[lo])
            else:
                resampled.append(cv2.addWeighted(raw_frames[lo], 1.0 - frac, raw_frames[hi], frac, 0.0))

    return resampled, np.array([width, height, x0, x1, y0, y1], dtype=np.int32), src_duration_sec, src_fps


def extract_layer_stream(
    layer_id: str,
    video_path: Path,
    bbox: GeoBoundingBox,
    total_bars: int = 8,
    frames_per_bar: int = 20,
    tile_size: Tuple[int, int] = (384, 264),
    time_start_sec: Optional[float] = None,
    window_span_sec: Optional[float] = None,
    predecoded_tiles_override: Optional[Tuple[List[np.ndarray], np.ndarray, float, float]] = None,
) -> SynchronizedLayerStream:
    """
    Extracts and analyzes a single NASA video on the canonical timeline (`total_bars * frames_per_bar` frames),
    100% isolated from the other layers.
    """
    cid = normalize_layer_id(layer_id)
    bbox = bbox.validate()
    num_analysis_frames = max(16, total_bars * frames_per_bar)
    musical_slots = total_bars * 8
    tile_w, tile_h = tile_size

    if predecoded_tiles_override is not None:
        raw_frames_check, geom, src_dur, src_fps = predecoded_tiles_override
    else:
        raw_frames_check, geom, src_dur, src_fps = _decode_video_resampled_tiles(
            video_path=video_path,
            bbox=bbox,
            num_target_frames=num_analysis_frames,
            tile_size=tile_size,
            time_start_sec=time_start_sec,
            window_span_sec=window_span_sec,
            blend_frames=(cid != "melody"),
        )
    width, height, x0, x1, y0, y1 = [int(v) for v in geom]

    # Lightning has no GMAO HUD; in GMAO videos discard logo/timestamp if they intersect
    has_hud = cid != "melody"
    raw_mask = build_hud_valid_mask(width, height, x0, x1, y0, y1, has_gmao_hud=has_hud)
    mask_tile = cv2.resize(
        raw_mask.astype(np.uint8), (tile_w, tile_h), interpolation=cv2.INTER_NEAREST
    ).astype(bool)
    if not mask_tile.any():
        mask_tile[:] = True

    # For lightning we avoid cross-blending between keyframes when resampling to preserve flash sharpness
    if cid == "melody":
        # Nearest re-indexing preserves exact transient peaks
        frames_bgr = raw_frames_check
    else:
        frames_bgr = raw_frames_check

    fields_norm: List[np.ndarray] = []
    frame_hotspots: List[SpatialFlashPoint] = []
    frame_motions: List[float] = []
    frame_wind_orients: List[float] = []
    frame_wind_contrasts: List[float] = []
    frame_wind_turbs: List[float] = []
    step_means: List[float] = []
    step_peaks: List[float] = []
    step_active: List[float] = []
    step_stds: List[float] = []
    temporal_diffs: List[float] = []
    rgb_accum = np.zeros(3, dtype=np.float64)

    prev_field: Optional[np.ndarray] = None
    for tile_bgr in frames_bgr:
        tile_rgb = cv2.cvtColor(tile_bgr, cv2.COLOR_BGR2RGB)
        rgb_accum += tile_rgb[mask_tile].mean(axis=0)

        field = decode_layer_field(cid, tile_rgb, bbox.center_lat)
        fields_norm.append(field)

        vals = field[mask_tile]
        if cid == "melody":
            active_ratio = float((vals > 0.10).mean())
            p95 = float(np.percentile(vals, 95))
            eff = float(np.clip(0.55 * p95 + 2.2 * active_ratio, 0.0, 1.0))
            step_means.append(eff)
            step_peaks.append(float(np.percentile(vals, 99.5)))
            step_active.append(active_ratio)
        else:
            step_means.append(float(vals.mean()))
            step_peaks.append(float(np.percentile(vals, 95)))
            step_active.append(float((vals > 0.35).mean()))

        step_stds.append(float(np.clip(vals.std() * 3.2, 0.0, 1.0)))
        frame_hotspots.append(_find_frame_hotspot(cid, field, prev_field, mask_tile))
        frame_motions.append(_compute_frame_motion(field, prev_field, mask_tile))

        if cid == "wind":
            wo, wc, wt = _compute_wind_frame_metrics(field, prev_field, mask_tile)
            frame_wind_orients.append(wo)
            frame_wind_contrasts.append(wc)
            frame_wind_turbs.append(wt)

        if prev_field is not None:
            temporal_diffs.append(float(np.abs(field - prev_field)[mask_tile].mean()))
        prev_field = field

    # Aggregate series into `musical_slots` eighth-notes (total_bars * 8)
    slot_series: List[float] = []
    slot_contours: List[float] = []
    slot_hotspots: List[SpatialFlashPoint] = []
    slot_motions: List[float] = []
    wind_orient_series: List[float] = []
    wind_contrast_series: List[float] = []
    wind_turb_series: List[float] = []

    edges = np.linspace(0, len(frames_bgr), musical_slots + 1, dtype=int)
    for s_idx in range(musical_slots):
        i0 = int(edges[s_idx])
        i1 = max(i0 + 1, int(edges[s_idx + 1]))
        sub_means = step_means[i0:i1]
        sub_spots = frame_hotspots[i0:i1]

        if cid == "melody":
            best_local = max(sub_spots, key=lambda sp: sp.intensity)
            slot_val = float(max(sub_means))
        else:
            best_local = sub_spots[len(sub_spots) // 2]
            slot_val = float(np.mean(sub_means))

        slot_series.append(slot_val)
        slot_contours.append(float(np.clip(1.0 - best_local.y_norm, 0.0, 1.0)))
        slot_hotspots.append(best_local)
        slot_motions.append(float(np.mean(frame_motions[i0:i1])))

        if cid == "wind":
            wind_orient_series.append(float(np.mean(frame_wind_orients[i0:i1])))
            wind_contrast_series.append(float(np.mean(frame_wind_contrasts[i0:i1])))
            wind_turb_series.append(float(np.mean(frame_wind_turbs[i0:i1])))

    raw_temp_var = float(np.mean(temporal_diffs)) if temporal_diffs else 0.0
    temp_scale = 28.0 if cid == "melody" else 22.0
    temporal_variation = float(np.clip(raw_temp_var * temp_scale + np.std(slot_series) * 2.5, 0.0, 1.0))
    rgb_mean = tuple((rgb_accum / len(frames_bgr)).tolist())
    motion_mean = float(np.mean(frame_motions[1:])) if len(frame_motions) > 1 else 0.0

    scan_windows: List[dict] = []
    bar_column_profiles: List[List[dict]] = []
    lightning_events: List[LightningEvent] = []
    persistence_grid: Optional[np.ndarray] = None
    persistence_hotspots: List[dict] = []
    adaptive_thresholds: Dict[str, float] = {}
    frame_yellow_bursts: List[dict] = []

    if cid in ("chords", "bass"):
        scan_windows = _compute_scan_windows(fields_norm, mask_tile, num_windows=total_bars * 2, layer_id=cid)
        bar_column_profiles = _compute_bar_column_profiles(
            fields_norm, mask_tile, total_bars=total_bars, cols_per_bar=8
        )
    elif cid == "melody":
        (
            lightning_events,
            persistence_grid,
            persistence_hotspots,
            adaptive_thresholds,
            frame_yellow_bursts,
        ) = _extract_lightning_events_and_persistence(fields_norm, mask_tile, total_bars=total_bars)

    features = LayerFeatures(
        layer_id=cid,
        video_file=video_path.name,
        source_duration_sec=src_dur,
        source_fps=src_fps,
        analysis_frames=len(frames_bgr),
        mean_index=float(np.clip(np.mean(step_means), 0.0, 1.0)),
        peak_index=float(np.clip(np.max(step_peaks), 0.0, 1.0)),
        spatial_contrast=float(np.clip(np.mean(step_stds), 0.0, 1.0)),
        temporal_variation=temporal_variation,
        active_area_ratio=float(np.clip(np.mean(step_active), 0.0, 1.0)),
        time_series=slot_series,
        contour_series=slot_contours,
        slot_hotspots=slot_hotspots,
        raw_rgb_mean=(rgb_mean[0], rgb_mean[1], rgb_mean[2]),
        motion_mean=motion_mean,
        motion_series=slot_motions,
        scan_windows=scan_windows,
        bar_column_profiles=bar_column_profiles,
        lightning_events=lightning_events,
        persistence_hotspots=persistence_hotspots,
        adaptive_thresholds=adaptive_thresholds,
        frame_yellow_bursts=frame_yellow_bursts,
        wind_orientation=float(np.mean(frame_wind_orients)) if frame_wind_orients else 0.0,
        wind_local_contrast=float(np.mean(frame_wind_contrasts)) if frame_wind_contrasts else 0.0,
        wind_turbulence=float(np.mean(frame_wind_turbs)) if frame_wind_turbs else 0.0,
        wind_orientation_series=wind_orient_series,
        wind_contrast_series=wind_contrast_series,
        wind_turbulence_series=wind_turb_series,
    )

    return SynchronizedLayerStream(
        features=features,
        frames_bgr=frames_bgr,
        fields_norm=fields_norm,
        frame_hotspots=frame_hotspots,
        persistence_grid=persistence_grid,
    )


def extract_all_layer_streams(
    bbox: GeoBoundingBox,
    video_dir: Path = BASE_DIR,
    total_bars: int = 8,
    frames_per_bar: int = 20,
    tile_size: Tuple[int, int] = (384, 264),
    video_overrides: Optional[Dict[str, Path]] = None,
    time_start_sec: Optional[float] = None,
    window_span_sec: Optional[float] = None,
    preview_out_path: Optional[Path] = None,
) -> Dict[str, SynchronizedLayerStream]:
    """
    Extracts the 5 canonical streams (`chords`, `bass`, `melody`, `temperature`, `wind`)
    on the same common timeline, allowing individual video overrides (`video_overrides`).
    """
    bbox = bbox.validate()
    overrides_norm: Dict[str, Path] = {}
    if video_overrides:
        for k, v in video_overrides.items():
            overrides_norm[normalize_layer_id(k)] = Path(v)

    labels = {
        "melody": "Melodia: Raios (ISS)",
        "chords": "Acordes: CO (GMAO)",
        "temperature": "Regente: Temperatura",
        "bass": "Baixo: NO2 (GMAO)",
        "wind": "Efeito: Vento (GMAO)",
    }
    ordered_keys = ["melody", "chords", "temperature", "bass", "wind"]

    streams: Dict[str, SynchronizedLayerStream] = {}
    tiles: List[np.ndarray] = []

    for layer_id in ordered_keys:
        vpath = overrides_norm.get(layer_id, Path(video_dir) / VIDEO_FILES[layer_id])
        stream = extract_layer_stream(
            layer_id=layer_id,
            video_path=vpath,
            bbox=bbox,
            total_bars=total_bars,
            frames_per_bar=frames_per_bar,
            tile_size=tile_size,
            time_start_sec=time_start_sec,
            window_span_sec=window_span_sec,
        )
        streams[layer_id] = stream

        if preview_out_path is not None and stream.frames_bgr:
            mid_frame = stream.frames_bgr[len(stream.frames_bgr) // 2]
            tile = cv2.resize(mid_frame, (240, 180), interpolation=cv2.INTER_AREA)
            banner = np.zeros((34, 240, 3), dtype=np.uint8) + 24
            cv2.putText(
                banner,
                labels.get(layer_id, layer_id),
                (8, 22),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (235, 235, 235),
                1,
                cv2.LINE_AA,
            )
            tiles.append(np.vstack([banner, tile]))

    if preview_out_path is not None and tiles:
        preview_out_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(preview_out_path), np.hstack(tiles))

    return streams
