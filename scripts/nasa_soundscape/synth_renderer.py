"""
Sintetizador Polifônico Independente + Bus Linear de Efeitos de Vento (NumPy + wave).

Arquitetura Earth Jukebox:
  - 3 Instrumentos secos independentes com GANHO FIXO constante (`STEM_GAINS`):
      * `chords.wav` (CO — Pad harmônico unison)
      * `bass.wav`   (NO2 — Sub-bass musical contínuo com cutoff, drive e ataque variáveis)
      * `melody.wav` (Raios — Celesta/Rhodes com harmônicos no ataque e parciais por densidade)
  - `mix_dry.wav`: soma direta dos stems dos instrumentos ligados.
  - `mix_wind.wav`: bus de efeitos de Vento estritamente LINEAR (Chorus + Ping-Pong Delay em
    colcheia pontuada + Filtro Ressonante em movimento + Auto-Pan + Hall/Shimmer Reverb por
    convolução, sem geração de ruído próprio) aplicado sobre `mix_dry` quando `--wind on`
    (ou igual a `mix_dry` quando `--wind off`).
  - Limitador suave (`MASTER_LIMITER_THRESHOLD`) aplicado apenas como proteção de teto no master.
"""

from dataclasses import dataclass
from pathlib import Path
import math
from typing import Dict, Iterable, List, Optional
import wave
import numpy as np

from . import config as _cfg
from .config import INSTRUMENT_LAYERS, MASTER_LIMITER_THRESHOLD, STEM_GAINS

SAMPLE_RATE = 44100


@dataclass
class RenderedAudioBundle:
    """Pacote com caminhos dos WAVs gerados, sinais em memória e envelopes RMS para vídeo."""
    stem_paths: Dict[str, Path]            # Apenas os instrumentos ligados (chords, bass, melody)
    mix_dry_path: Path
    mix_wind_path: Path
    active_mix_path: Path                  # mix_wind_path se wind=='on', senão mix_dry_path
    frame_envelopes: Dict[str, List[float]]
    duration_seconds: float
    sample_rate: int = SAMPLE_RATE


def midi_to_hz(midi_pitch: float) -> float:
    return 440.0 * (2.0 ** ((midi_pitch - 69.0) / 12.0))


def read_pcm16_wav_float(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wf:
        n_ch = wf.getnchannels()
        raw = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32767.0
        if n_ch == 2:
            return raw.reshape((-1, 2))
        return np.stack([raw, raw], axis=1)


def write_pcm16_wav(stereo_sig: np.ndarray, out_path: Path, sr: int = SAMPLE_RATE) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pcm16 = np.clip(np.round(stereo_sig * 32767.0), -32768, 32767).astype(np.int16)
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm16.tobytes())
    return out_path


def soft_limit_master(
    stereo_sig: np.ndarray, threshold: float = MASTER_LIMITER_THRESHOLD
) -> np.ndarray:
    """
    Limitador suave aplicado apenas no master: 100% linear (identidade exata) para |x| <= threshold,
    com compressão suave tanh acima do joelho até 0.998 para evitar clipping digital.
    """
    mag = np.abs(stereo_sig)
    if float(mag.max()) <= threshold:
        return stereo_sig.astype(np.float32)
    headroom = max(0.01, 0.998 - threshold)
    over = np.maximum(0.0, mag - threshold)
    limited_mag = np.where(
        mag <= threshold,
        mag,
        threshold + headroom * np.tanh(over / headroom),
    )
    return (np.sign(stereo_sig) * limited_mag).astype(np.float32)


def apply_temperature_color_tilt(
    stereo_sig: np.ndarray, temp_index: float, sr: int = SAMPLE_RATE
) -> np.ndarray:
    """
    Inclinação tonal global opcional (--temperature-color): mais quente (>0.5) abre levemente o topo;
    mais frio (<0.5) escurece suavemente o master. Operador linear via FFT.
    """
    n = stereo_sig.shape[0]
    if n == 0:
        return stereo_sig
    tilt = float(np.clip(temp_index - 0.5, -0.5, 0.5)) * 0.28
    if abs(tilt) < 1e-4:
        return stereo_sig
    freqs = np.fft.rfftfreq(n, d=1.0 / sr)
    norm_f = np.maximum(freqs, 60.0) / 750.0
    gain = np.clip(norm_f ** tilt, 0.74, 1.34).astype(np.float32)
    out = np.empty_like(stereo_sig, dtype=np.float32)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(stereo_sig[:, ch]) * gain, n=n).astype(np.float32)
    return out


def _fft_lowpass_1d(sig: np.ndarray, cutoff_hz: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    if sig.size == 0:
        return sig
    freqs = np.fft.rfftfreq(sig.size, d=1.0 / sr)
    h = 1.0 / (1.0 + (freqs / max(20.0, cutoff_hz)) ** 2)
    spec = np.fft.rfft(sig) * h
    return np.fft.irfft(spec, n=sig.size).astype(np.float32)


def _fft_bandpass_1d(
    sig: np.ndarray, low_hz: float, high_hz: float, sr: int = SAMPLE_RATE
) -> np.ndarray:
    if sig.size == 0:
        return sig
    freqs = np.fft.rfftfreq(sig.size, d=1.0 / sr)
    hp = (freqs ** 2) / (freqs ** 2 + max(10.0, low_hz) ** 2)
    lp = 1.0 / (1.0 + (freqs / max(40.0, high_hz)) ** 2)
    spec = np.fft.rfft(sig) * hp * lp
    return np.fft.irfft(spec, n=sig.size).astype(np.float32)


def _fft_lowpass_stereo(stereo: np.ndarray, cutoff_hz: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    n = stereo.shape[0]
    if n == 0:
        return stereo.copy()
    freqs = np.fft.rfftfreq(n, d=1.0 / sr)
    h = (1.0 / (1.0 + (freqs / max(20.0, cutoff_hz)) ** 4)).astype(np.float32)
    out = np.empty_like(stereo, dtype=np.float32)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(stereo[:, ch]) * h, n=n).astype(np.float32)
    return out


def _fft_resonant_peak_stereo(
    stereo: np.ndarray, center_hz: float, resonance: float, sr: int = SAMPLE_RATE
) -> np.ndarray:
    """Filtro linear com pico ressonante audível em `center_hz` para movimento espectral do vento."""
    n = stereo.shape[0]
    if n == 0:
        return stereo
    freqs = np.fft.rfftfreq(n, d=1.0 / sr)
    res_c = float(np.clip(resonance, 0.0, 1.0))
    bw = max(85.0, center_hz * (0.46 - 0.28 * res_c))
    peak_gain = 0.55 + 1.35 * res_c
    bell = 1.0 + peak_gain / (1.0 + ((freqs - center_hz) / bw) ** 2)
    lp = 1.0 / (1.0 + (freqs / (3400.0 + 2800.0 * res_c)) ** 2)
    h = (bell * lp / (1.0 + 0.36 * peak_gain)).astype(np.float32)
    out = np.empty_like(stereo, dtype=np.float32)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(stereo[:, ch]) * h, n=n).astype(np.float32)
    return out


def _add_stereo_clip(
    bus: np.ndarray, start_sample: int, left: np.ndarray, right: np.ndarray
) -> None:
    if start_sample >= bus.shape[0] or left.size == 0:
        return
    s0 = max(0, start_sample)
    end_s = min(bus.shape[0], start_sample + left.size)
    n = end_s - s0
    if n <= 0:
        return
    offset = s0 - start_sample
    bus[s0:end_s, 0] += left[offset : offset + n]
    bus[s0:end_s, 1] += right[offset : offset + n]


def _wrap_or_trim_stem(
    stem: np.ndarray, loop_samples: int, seamless_loop: bool, sr: int = SAMPLE_RATE
) -> np.ndarray:
    """Ajusta o buffer para `loop_samples` de forma linear."""
    if loop_samples <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    if stem.shape[0] < loop_samples:
        out = np.zeros((loop_samples, 2), dtype=np.float32)
        out[: stem.shape[0]] = stem
    else:
        out = stem[:loop_samples].copy()
        if seamless_loop:
            wrap_n = min(loop_samples, stem.shape[0] - loop_samples)
            if wrap_n > 0:
                out[:wrap_n] += stem[loop_samples : loop_samples + wrap_n]

    if not seamless_loop and loop_samples > 0:
        fi = min(loop_samples // 8, int(0.020 * sr))
        fo = min(loop_samples // 6, int(0.35 * sr))
        if fi > 0:
            out[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)[:, None]
        if fo > 0:
            out[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None]
    return out.astype(np.float32)


# ============================================================================
# Síntese dos 3 Instrumentos Independentes
# ============================================================================

def _render_pad_note(
    freq: float, dur_sec: float, velocity: float, brightness: float = 0.5, sr: int = SAMPLE_RATE
) -> tuple[np.ndarray, np.ndarray]:
    release_sec = 0.80
    total_sec = max(0.25, dur_sec + release_sec)
    n = int(total_sec * sr)
    t = np.arange(n, dtype=np.float32) / sr

    f_l = freq * (2.0 ** (-8.0 / 1200.0))
    f_c = freq
    f_r = freq * (2.0 ** (8.0 / 1200.0))

    bright_mul = float(0.78 + 0.44 * np.clip(brightness, 0.0, 1.0))
    sig_l = np.zeros(n, dtype=np.float32)
    sig_r = np.zeros(n, dtype=np.float32)
    two_pi = np.float32(2.0 * np.pi)
    for k, amp in ((1, 1.0), (2, 0.36 * bright_mul), (3, 0.19 * bright_mul), (4, 0.09 * bright_mul), (5, 0.04 * bright_mul)):
        if freq * k < 5500.0:
            amp32 = np.float32(amp)
            w_l = np.float32(two_pi * f_l * k)
            w_c = np.float32(two_pi * f_c * k)
            w_r = np.float32(two_pi * f_r * k)
            ph_l = np.float32(0.3 * k)
            ph_r = np.float32(1.1 * k)
            sin_c = np.float32(0.35) * np.sin(w_c * t)
            sig_l += amp32 * (np.float32(0.65) * np.sin(w_l * t + ph_l) + sin_c)
            sig_r += amp32 * (np.float32(0.65) * np.sin(w_r * t + ph_r) + sin_c)

    atk_n = min(n // 2, int(0.38 * sr))
    rel_n = min(n - atk_n, int(release_sec * sr))
    env = np.ones(n, dtype=np.float32)
    if atk_n > 0:
        env[:atk_n] = 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, atk_n, dtype=np.float32)))
    if rel_n > 0:
        env[-rel_n:] = 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, rel_n, dtype=np.float32)))

    lfo = 0.92 + 0.08 * np.sin(2.0 * np.pi * 0.32 * t)
    gain = 0.095 * velocity * env * lfo
    return (sig_l * gain).astype(np.float32), (sig_r * gain).astype(np.float32)


def _render_bass_note(
    freq: float,
    dur_sec: float,
    velocity: float,
    cutoff_hz: float,
    drive: float,
    attack_sec: float = 0.018,
    sr: int = SAMPLE_RATE,
) -> tuple[np.ndarray, np.ndarray]:
    rel_sec = 0.11
    total_sec = max(0.12, dur_sec + rel_sec)
    n = int(total_sec * sr)
    t = np.arange(n, dtype=np.float32) / sr
    two_pi = np.float32(2.0 * np.pi)

    drv = float(np.clip(drive, 0.0, 0.8))
    base_cut = max(75.0, float(cutoff_hz))

    # 1. Fundamental sub-grave 100% limpa (sem saturação) para sustentar a harmonia com peso e clareza
    sub_fund = np.sin(np.float32(two_pi * freq) * t)

    # 2. Corpo harmônico médio-grave (2f..7f) com abertura dinâmica de filtro no pluck + drive suave
    c_env = base_cut * (1.0 + (0.42 + 0.85 * drv) * np.exp(-t * (7.5 + 5.5 * drv))).astype(np.float32)
    harm_weights = ((2, 0.54), (3, 0.29), (4, 0.16), (5, 0.09), (6, 0.05), (7, 0.03))
    upper_harm = np.zeros(n, dtype=np.float32)
    for k, w_k in harm_weights:
        fk = float(freq * k)
        if fk >= 2400.0:
            break
        att = 1.0 / (1.0 + (fk / c_env) ** 2.5)
        ph = np.float32(0.17 * k)
        upper_harm += np.float32(w_k) * att * np.sin(np.float32(two_pi * fk) * t + ph)

    if drv > 0.015:
        k_drv = 1.0 + 2.4 * drv
        upper_harm = (np.tanh(upper_harm * np.float32(k_drv)) / float(math.tanh(k_drv))).astype(np.float32)
        upper_harm = _fft_lowpass_1d(upper_harm, min(1150.0, base_cut * 2.35), sr)

    sig = (0.76 * sub_fund + (0.52 + 0.36 * drv) * upper_harm).astype(np.float32)

    # 3. Envelope orgânico de dedo/corda: ataque cosseno + corpo quente sustentado + release suave
    atk_n = max(24, min(n // 2, int(float(np.clip(attack_sec, 0.006, 0.090)) * sr)))
    rel_n = min(n - atk_n, int(rel_sec * sr))
    env = (0.68 + 0.32 * np.exp(-t * (1.55 + 1.15 * drv))).astype(np.float32)
    env[:atk_n] *= 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, atk_n, dtype=np.float32)))
    if rel_n > 0:
        env[-rel_n:] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, rel_n, dtype=np.float32)))

    mono = (sig * env * np.float32(0.24 * velocity)).astype(np.float32)
    return mono, mono


def _render_melody_bell_note(
    freq: float,
    dur_sec: float,
    velocity: float,
    brightness: float,
    pan: float,
    attack_sec: float = 0.016,
    release_sec: float = 0.85,
    harmonic_partials: float = 0.0,
    sr: int = SAMPLE_RATE,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Celesta / Rhodes expressivo:
      - Densidade local de clarões (`brightness`) abre harmônicos no ataque.
      - Múltiplos clarões no mesmo slot (`harmonic_partials`) adicionam parciais de oitava (2f) e quinta (3f).
      - Poucos eventos no compasso usam `attack_sec` suave e `release_sec` longo.
    """
    rel_s = float(np.clip(release_sec, 0.35, 2.20))
    total_sec = max(0.30, dur_sec + rel_s)
    n = int(total_sec * sr)
    t = np.arange(n, dtype=np.float32) / sr

    b_clamped = float(np.clip(brightness, 0.0, 1.0))
    p_clamped = float(np.clip(harmonic_partials, 0.0, 1.0))

    # Harmônicos de ataque (abrem fortemente com a densidade de pontos amarelos no quadro)
    atk_harm_env = np.exp(-t * (5.2 - 2.4 * b_clamped)).astype(np.float32)
    carrier = (
        0.84 * np.sin(2.0 * np.pi * freq * t)
        + (0.06 + 0.42 * b_clamped) * np.sin(2.0 * np.pi * (2.0 * freq) * t) * atk_harm_env
        + (0.01 + 0.24 * b_clamped) * np.sin(2.0 * np.pi * (3.0 * freq) * t) * np.exp(-t * 7.5)
        + (0.14 * max(0.0, b_clamped - 0.35)) * np.sin(2.0 * np.pi * (4.0 * freq) * t) * np.exp(-t * 11.5)
    )

    # Parciais sustentados de oitava (2f) e quinta (1.5f) quando há muitos clarões no quadro
    if p_clamped > 0.02:
        sust_harm_env = np.exp(-t / max(0.55, dur_sec * 1.1)).astype(np.float32)
        if 2.0 * freq < 9500.0:
            carrier += (0.28 * p_clamped) * np.sin(2.0 * np.pi * (2.0 * freq) * t + 0.4) * sust_harm_env
        if 1.4983 * freq < 8500.0:
            carrier += (0.18 * p_clamped) * np.sin(2.0 * np.pi * (1.498307 * freq) * t + 0.9) * sust_harm_env

    cutoff_hz = 1250.0 + 3600.0 * b_clamped + 1300.0 * p_clamped
    carrier = _fft_lowpass_1d(carrier.astype(np.float32), cutoff_hz, sr)

    atk_n = max(32, min(n // 2, int(float(np.clip(attack_sec, 0.008, 0.140)) * sr)))
    decay_tau = max(0.48, dur_sec * 0.95 + 0.45 * rel_s)
    env = np.exp(-t / decay_tau).astype(np.float32)
    env[:atk_n] *= 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, atk_n, dtype=np.float32)))
    fade_n = min(n - atk_n, int(min(0.55, 0.35 * rel_s) * sr))
    if fade_n > 0:
        env[-fade_n:] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fade_n, dtype=np.float32)))

    mono = (carrier * env * (0.185 * velocity)).astype(np.float32)
    angle = (float(np.clip(pan, -0.92, 0.92)) + 1.0) * (math.pi / 4.0)
    return (mono * math.cos(angle)).astype(np.float32), (mono * math.sin(angle)).astype(np.float32)


def _render_crystal_sparkle_note(
    freq: float,
    dur_sec: float,
    velocity: float,
    brightness: float,
    pan: float,
    sr: int = SAMPLE_RATE,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Cintilação cristalina aguda (Celesta / Glockenspiel delicado) para explosões de pontos amarelos:
    passa-altas suave acima de 850 Hz para nunca embolar o registro médio da melodia principal.
    """
    rel_s = 0.24
    total_sec = max(0.14, dur_sec + rel_s)
    n = int(total_sec * sr)
    t = np.arange(n, dtype=np.float32) / sr
    b_c = float(np.clip(brightness, 0.0, 1.0))

    carrier = np.sin(2.0 * np.pi * freq * t)
    if 2.0 * freq < 12000.0:
        carrier += (0.28 + 0.18 * b_c) * np.sin(2.0 * np.pi * (2.0 * freq) * t + 0.3) * np.exp(-t * 14.0)
    if 3.0 * freq < 14000.0:
        carrier += (0.12 * b_c) * np.sin(2.0 * np.pi * (3.0 * freq) * t + 0.8) * np.exp(-t * 22.0)

    carrier = _fft_bandpass_1d(carrier.astype(np.float32), 850.0, 8200.0, sr)
    atk_n = max(16, min(n // 3, int(0.006 * sr)))
    env = np.exp(-t / max(0.11, dur_sec * 0.75 + 0.10)).astype(np.float32)
    env[:atk_n] *= 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, atk_n, dtype=np.float32)))
    fade_n = min(n - atk_n, int(0.08 * sr))
    if fade_n > 0:
        env[-fade_n:] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fade_n, dtype=np.float32)))

    mono = (carrier * env * (0.145 * velocity)).astype(np.float32)
    angle = (float(np.clip(pan, -0.90, 0.90)) + 1.0) * (math.pi / 4.0)
    return (mono * math.cos(angle)).astype(np.float32), (mono * math.sin(angle)).astype(np.float32)


def render_instrument_stem(
    instrument_id: str,
    notes: List[dict],
    bpm: float,
    total_bars: int,
    seamless_loop: bool = False,
    sr: int = SAMPLE_RATE,
    sparkle_notes: Optional[List[dict]] = None,
    gain_override: Optional[float] = None,
    sparkle_gain: Optional[float] = None,
) -> np.ndarray:
    """
    Renderiza um único instrumento seco de forma 100% isolada e determinística.
    Depende exclusivamente de `notes`, `bpm`, `total_bars` e `STEM_GAINS[instrument_id]`.
    """
    if instrument_id not in INSTRUMENT_LAYERS:
        raise ValueError(f"Instrumento desconhecido: {instrument_id}")

    beat_sec = 60.0 / float(bpm)
    loop_samples = int(round(total_bars * 4.0 * beat_sec * sr))
    tail_samples = int(round(2.4 * sr))
    total_samples = loop_samples + tail_samples

    bus = np.zeros((total_samples, 2), dtype=np.float32)

    if instrument_id == "chords":
        for n in notes:
            s0 = int(round(float(n["start_beat"]) * beat_sec * sr))
            dur_s = float(n["duration_beats"]) * beat_sec
            bright = float(n.get("brightness") if n.get("brightness") is not None else 0.5)
            l_sig, r_sig = _render_pad_note(
                midi_to_hz(float(n["pitch"])), dur_s, float(n["velocity"]), bright, sr
            )
            _add_stereo_clip(bus, s0, l_sig, r_sig)
        # Brilho de filtro do pad modulado apenas pelo próprio vídeo de CO (média das notas se houver)
        pad_cutoff = 1550.0
        if notes:
            b_mean = float(np.mean([float(n.get("brightness") or 0.5) for n in notes]))
            pad_cutoff = 1350.0 + 900.0 * b_mean
        bus[:, 0] = _fft_lowpass_1d(bus[:, 0], pad_cutoff, sr)
        bus[:, 1] = _fft_lowpass_1d(bus[:, 1], pad_cutoff, sr)

    elif instrument_id == "bass":
        for n in notes:
            s0 = int(round(float(n["start_beat"]) * beat_sec * sr))
            dur_s = float(n["duration_beats"]) * beat_sec
            cutoff = float(n.get("cutoff_hz") or 240.0)
            drive = float(n.get("drive") if n.get("drive") is not None else 0.15)
            atk = float(n.get("attack_sec") if n.get("attack_sec") is not None else 0.018)
            l_sig, r_sig = _render_bass_note(
                midi_to_hz(float(n["pitch"])),
                dur_s,
                float(n["velocity"]),
                cutoff,
                drive,
                atk,
                sr,
            )
            _add_stereo_clip(bus, s0, l_sig, r_sig)

    elif instrument_id == "melody":
        for n in notes:
            s0 = int(round(float(n["start_beat"]) * beat_sec * sr))
            dur_s = float(n["duration_beats"]) * beat_sec
            src_x = float(n.get("source_x", 0.5))
            pan = float(np.clip((src_x - 0.5) * 1.50, -0.82, 0.82))
            bright = float(n.get("brightness") if n.get("brightness") is not None else 0.5)
            atk = float(n.get("attack_sec") if n.get("attack_sec") is not None else 0.016)
            rel = float(n.get("release_sec") if n.get("release_sec") is not None else 0.85)
            partials = float(n.get("harmonic_partials") if n.get("harmonic_partials") is not None else 0.0)
            l_sig, r_sig = _render_melody_bell_note(
                midi_to_hz(float(n["pitch"])),
                dur_s,
                float(n["velocity"]),
                bright,
                pan,
                atk,
                rel,
                partials,
                sr,
            )
            _add_stereo_clip(bus, s0, l_sig, r_sig)

        if sparkle_notes:
            sp_gain = float(_cfg.MELODY_SPARKLE_GAIN if sparkle_gain is None else sparkle_gain)
            if sp_gain > 0.0:
                for sp in sparkle_notes:
                    s0 = int(round(float(sp["start_beat"]) * beat_sec * sr))
                    dur_s = float(sp["duration_beats"]) * beat_sec
                    src_x = float(sp.get("source_x", 0.5))
                    pan = float(np.clip((src_x - 0.5) * 1.65, -0.88, 0.88))
                    bright = float(sp.get("brightness") if sp.get("brightness") is not None else 0.75)
                    if sp.get("sub_role") == "crystal_sparkle":
                        l_sig, r_sig = _render_crystal_sparkle_note(
                            midi_to_hz(float(sp["pitch"])),
                            dur_s,
                            float(sp["velocity"]),
                            bright,
                            pan,
                            sr,
                        )
                    else:
                        atk = float(sp.get("attack_sec") if sp.get("attack_sec") is not None else 0.015)
                        rel = float(sp.get("release_sec") if sp.get("release_sec") is not None else 0.68)
                        partials = float(sp.get("harmonic_partials") if sp.get("harmonic_partials") is not None else 0.15)
                        l_sig, r_sig = _render_melody_bell_note(
                            midi_to_hz(float(sp["pitch"])),
                            dur_s,
                            float(sp["velocity"]),
                            bright,
                            pan,
                            atk,
                            rel,
                            partials,
                            sr,
                        )
                    _add_stereo_clip(bus, s0, l_sig * sp_gain, r_sig * sp_gain)

    trimmed = _wrap_or_trim_stem(bus, loop_samples, seamless_loop=seamless_loop, sr=sr)
    fixed_gain = float(_cfg.STEM_GAINS[instrument_id] if gain_override is None else gain_override)
    return (trimmed * fixed_gain).astype(np.float32)


# ============================================================================
# Bus Linear de Efeitos de Vento (Sem geração de som próprio)
# ============================================================================

def _smooth_and_interp_curve(
    curve: List[float], n_samples: int, default_val: float = 0.3
) -> np.ndarray:
    if n_samples <= 0:
        return np.zeros(0, dtype=np.float32)
    if not curve:
        return np.full(n_samples, default_val, dtype=np.float32)
    arr = np.array(curve, dtype=np.float32)
    if arr.size >= 5:
        kernel = np.hanning(5).astype(np.float32)
        kernel /= kernel.sum()
        padded = np.pad(arr, (2, 2), mode="edge")
        arr = np.convolve(padded, kernel, mode="valid")
    if arr.size == 1:
        return np.full(n_samples, float(arr[0]), dtype=np.float32)
    x_src = np.linspace(0.0, 1.0, arr.size, dtype=np.float32)
    x_dst = np.linspace(0.0, 1.0, n_samples, dtype=np.float32)
    return np.interp(x_dst, x_src, arr).astype(np.float32)


def _linear_octave_shimmer_feed(mono_sig: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """
    Pitch-shift linear de +1 oitava por grãos Hann sobrepostos (2x read rate).
    Estritamente linear no sinal de entrada: T(a + b) == T(a) + T(b) e T(0) == 0.
    """
    n = mono_sig.size
    if n < 512:
        return np.zeros_like(mono_sig, dtype=np.float32)
    grain_len = 4096
    hop = grain_len // 2
    if n < grain_len:
        return _fft_bandpass_1d(mono_sig, 800.0, 5200.0, sr)

    win = np.hanning(grain_len).astype(np.float32)
    rel = np.arange(grain_len, dtype=np.float32)
    # Leitura a 2x centrada no meio do grão para manter sincronismo temporal
    read_offset = ((rel * 2.0) % grain_len)
    out = np.zeros(n, dtype=np.float32)

    for start in range(0, n - grain_len + 1, hop):
        pos = start + read_offset
        i0 = np.clip(pos.astype(np.int32), 0, n - 2)
        frac = pos - i0
        grain = (1.0 - frac) * mono_sig[i0] + frac * mono_sig[i0 + 1]
        out[start : start + grain_len] += grain * win

    return _fft_bandpass_1d(out * 0.55, 700.0, 5800.0, sr)


def apply_wind_bus(
    dry_stereo: np.ndarray,
    wind_params: dict,
    bpm: float,
    seamless_loop: bool = False,
    sr: int = SAMPLE_RATE,
) -> np.ndarray:
    """
    Aplica o bus espacial de Vento de forma ESTRITAMENTE LINEAR sobre `dry_stereo`.
      - Sem som próprio: `apply_wind_bus(0) == 0`.
      - Aditividade preservada: `apply_wind_bus(A + B) == apply_wind_bus(A) + apply_wind_bus(B)`.
      - Todos os moduladores interpolados por amostra vêm exclusivamente do vídeo de vento:
          * velocidade média -> decay do reverb e quantidade de efeito (wet)
          * contraste local  -> ressonância e movimento do filtro
          * direção dominante -> auto-pan e deriva estéreo
          * turbulência      -> profundidade do chorus e feedback do delay (colcheia pontuada)
    """
    n = dry_stereo.shape[0]
    if n == 0:
        return dry_stereo.copy()

    # Curvas suavizadas e interpoladas por amostra
    speed_s = np.clip(
        _smooth_and_interp_curve(wind_params.get("speed_curve", []), n, float(wind_params.get("mean_speed", 0.3))),
        0.0,
        1.0,
    )
    contrast_s = np.clip(
        _smooth_and_interp_curve(wind_params.get("contrast_curve", []), n, float(wind_params.get("mean_contrast", 0.3))),
        0.0,
        1.0,
    )
    orient_s = np.clip(
        _smooth_and_interp_curve(wind_params.get("orientation_curve", []), n, float(wind_params.get("mean_orientation", 0.0))),
        -1.0,
        1.0,
    )
    turb_s = np.clip(
        _smooth_and_interp_curve(wind_params.get("turbulence_curve", []), n, float(wind_params.get("mean_turbulence", 0.3))),
        0.0,
        1.0,
    )

    mean_speed = float(wind_params.get("mean_speed", float(speed_s.mean())))
    mean_contrast = float(wind_params.get("mean_contrast", float(contrast_s.mean())))
    mean_turb = float(wind_params.get("mean_turbulence", float(turb_s.mean())))
    reverb_decay_sec = float(wind_params.get("reverb_decay_seconds", 1.35 + 3.10 * mean_speed))

    # Curva perceptiva: garante ambiência audível mesmo em brisas suaves (5% -> 22%, 65% -> 81%)
    speed_eff_s = np.sqrt(np.clip(speed_s, 0.0, 1.0)).astype(np.float32)
    mean_speed_eff = float(math.sqrt(max(0.0, min(1.0, mean_speed))))

    # Crossover complementar estritamente linear: mantém o sub-grave (<175 Hz) firme e centrado
    sub_band = _fft_lowpass_stereo(dry_stereo, 175.0, sr)
    air_band = (dry_stereo - sub_band).astype(np.float32)

    t = np.arange(n, dtype=np.float32) / sr

    # 1. Direção dominante -> Auto-pan audível e deriva estéreo sobre a banda média/aguda
    drift_rate = 0.17 + 0.28 * mean_speed
    drift_lfo = np.sin(2.0 * np.pi * drift_rate * t).astype(np.float32)
    pan_pos = np.clip(
        0.54 * orient_s + (0.26 + 0.34 * np.abs(orient_s) + 0.22 * speed_eff_s) * drift_lfo,
        -0.84,
        0.84,
    )
    angle = (pan_pos + 1.0) * (np.pi / 4.0)
    pan_l = (np.cos(angle) * math.sqrt(2.0)).astype(np.float32)
    pan_r = (np.sin(angle) * math.sqrt(2.0)).astype(np.float32)

    cross = (0.14 * np.abs(orient_s) + 0.06 * speed_eff_s).astype(np.float32)
    drifted_air = np.stack(
        [
            air_band[:, 0] * pan_l * (1.0 - cross) + air_band[:, 1] * cross * pan_l,
            air_band[:, 1] * pan_r * (1.0 - cross) + air_band[:, 0] * cross * pan_r,
        ],
        axis=1,
    ).astype(np.float32)

    # 2. Contraste local -> Ressonância e movimento contínuo do filtro ("formante de vento")
    eff_res = float(np.clip(max(mean_contrast, 0.28 + 0.45 * mean_speed_eff), 0.25, 0.95))
    band_lo = _fft_resonant_peak_stereo(drifted_air, 480.0, eff_res, sr)
    band_hi = _fft_resonant_peak_stereo(drifted_air, 2350.0, eff_res, sr)
    sweep_alpha = np.clip(
        0.45 * contrast_s + 0.55 * (0.5 + 0.5 * np.sin(2.0 * np.pi * (0.22 + 0.14 * mean_speed) * t)),
        0.0,
        1.0,
    )[:, None].astype(np.float32)
    filtered_sig = ((1.0 - sweep_alpha) * band_lo + sweep_alpha * band_hi).astype(np.float32)

    # 3. Turbulência -> Chorus estéreo largo (decorrelação Haas L/R + LFO em quadratura)
    base_d_l = 0.011 * sr
    base_d_r = 0.019 * sr
    mod_d = (0.0018 + 0.0065 * turb_s + 0.0018 * speed_eff_s) * sr
    d_l = base_d_l + mod_d * np.sin(2.0 * np.pi * 0.43 * t)
    d_r = base_d_r + mod_d * np.cos(2.0 * np.pi * 0.39 * t)
    idx = np.arange(n, dtype=np.float32)
    rl = np.clip(idx - d_l, 0.0, max(0.0, n - 1.001))
    rr = np.clip(idx - d_r, 0.0, max(0.0, n - 1.001))
    i0_l = rl.astype(np.int32)
    fl = rl - i0_l
    i0_r = rr.astype(np.int32)
    fr = rr - i0_r
    i1_l = np.minimum(i0_l + 1, n - 1)
    i1_r = np.minimum(i0_r + 1, n - 1)

    ch_voice_l = (1.0 - fl) * filtered_sig[i0_l, 0] + fl * filtered_sig[i1_l, 0]
    ch_voice_r = (1.0 - fr) * filtered_sig[i0_r, 1] + fr * filtered_sig[i1_r, 1]
    chorus_gain = (0.20 + 0.32 * turb_s + 0.12 * speed_eff_s).astype(np.float32)
    chorus_wet = np.stack(
        [
            (0.82 * ch_voice_l - 0.28 * ch_voice_r) * chorus_gain,
            (0.82 * ch_voice_r - 0.28 * ch_voice_l) * chorus_gain,
        ],
        axis=1,
    ).astype(np.float32)

    # 4. Turbulência & Velocidade -> Ping-Pong Delay audível em colcheia pontuada (1º eco sem atenuação dupla)
    beat_sec = 60.0 / max(1.0, float(bpm))
    delay_samples = max(120, int(round(0.75 * beat_sec * sr)))
    feedback = float(np.clip(0.32 + 0.34 * max(mean_turb, 0.45 * mean_speed_eff), 0.30, 0.68))
    mono_send = 0.5 * (filtered_sig[:, 0] + filtered_sig[:, 1])
    delay_src = _fft_bandpass_1d(mono_send, 300.0, 3900.0, sr)
    delay_raw = np.zeros_like(dry_stereo, dtype=np.float32)
    tap_gain = 1.0
    for tap in range(1, 9):
        offset = tap * delay_samples
        if offset >= n:
            break
        ch = (tap - 1) % 2
        delay_raw[offset:, ch] += delay_src[: n - offset] * tap_gain
        if seamless_loop and offset < n:
            # Envolve suavemente a cauda do eco na virada do loop
            rem = delay_src[n - offset :]
            w_len = min(n, rem.size)
            if w_len > 0:
                delay_raw[:w_len, ch] += rem[:w_len] * (tap_gain * feedback)
        tap_gain *= feedback
    delay_mix_s = (0.20 + 0.24 * turb_s + 0.20 * speed_eff_s)[:, None].astype(np.float32)
    delay_wet = (delay_raw * delay_mix_s).astype(np.float32)

    # 5. Velocidade média -> Hall Reverb amplo + Shimmer cristalino de +1 oitava
    shimmer_mono = _linear_octave_shimmer_feed(mono_send, sr)
    shimmer_amt = float(np.clip(0.24 + 0.52 * mean_speed_eff, 0.20, 0.78))
    reverb_send = np.stack(
        [
            0.85 * filtered_sig[:, 0] + 0.65 * delay_wet[:, 0] + shimmer_amt * shimmer_mono,
            0.85 * filtered_sig[:, 1] + 0.65 * delay_wet[:, 1] + shimmer_amt * shimmer_mono,
        ],
        axis=1,
    ).astype(np.float32)

    eff_decay = max(1.55, reverb_decay_sec)
    ir_rng = np.random.default_rng(20260414)
    ir_len = int(min(5.5, max(1.10, eff_decay * 1.30)) * sr)
    ir_t = np.arange(ir_len, dtype=np.float32) / sr
    rt60_rate = 6.91 / max(0.65, eff_decay)
    ir_env = np.exp(-ir_t * rt60_rate).astype(np.float32)
    pre_n = min(ir_len // 4, int(0.024 * sr))
    if pre_n > 0:
        ir_env[:pre_n] *= np.linspace(0.0, 1.0, pre_n, dtype=np.float32)

    ir_l = _fft_bandpass_1d(ir_rng.standard_normal(ir_len).astype(np.float32) * ir_env, 180.0, 5600.0, sr)
    ir_r = _fft_bandpass_1d(ir_rng.standard_normal(ir_len).astype(np.float32) * ir_env, 180.0, 5600.0, sr)
    norm_ir = float(np.sqrt(0.5 * (np.sum(ir_l ** 2) + np.sum(ir_r ** 2)) + 1e-8))
    ir_l /= norm_ir
    ir_r /= norm_ir

    fft_n = 1 << (n + ir_len - 1).bit_length()
    conv_l = np.fft.irfft(np.fft.rfft(reverb_send[:, 0], fft_n) * np.fft.rfft(ir_l, fft_n), fft_n)
    conv_r = np.fft.irfft(np.fft.rfft(reverb_send[:, 1], fft_n) * np.fft.rfft(ir_r, fft_n), fft_n)

    if seamless_loop and conv_l.size > n:
        wrap_n = min(n, conv_l.size - n)
        conv_l_trim = conv_l[:n].copy()
        conv_r_trim = conv_r[:n].copy()
        conv_l_trim[:wrap_n] += conv_l[n : n + wrap_n]
        conv_r_trim[:wrap_n] += conv_r[n : n + wrap_n]
    else:
        conv_l_trim = conv_l[:n]
        conv_r_trim = conv_r[:n]

    reverb_mix_s = (0.52 + 0.72 * speed_eff_s)[:, None].astype(np.float32)
    reverb_wet = (np.stack([conv_l_trim, conv_r_trim], axis=1) * reverb_mix_s).astype(np.float32)

    # Combinação linear: sub-grave limpo + ar filtrado/panoramizado + Chorus + Ping-Pong Delay + Shimmer Reverb
    air_filter_mix = np.clip(0.54 + 0.34 * np.maximum(speed_eff_s, contrast_s), 0.50, 0.90)[:, None].astype(np.float32)
    air_direct = (1.0 - air_filter_mix) * air_band + air_filter_mix * filtered_sig
    dry_keep = (0.72 - 0.24 * speed_eff_s)[:, None].astype(np.float32)
    wet_total = chorus_wet + delay_wet + reverb_wet
    headroom_trim = float(0.88 / (1.0 + 0.28 * mean_speed_eff))
    out = (0.94 * sub_band + (dry_keep * air_direct + wet_total) * headroom_trim).astype(np.float32)

    if not seamless_loop and n > 0:
        fo = min(n // 8, int(0.30 * sr))
        if fo > 0:
            out[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None]
    return out


def compute_frame_rms_envelope(stereo_sig: np.ndarray, num_video_frames: int) -> List[float]:
    if num_video_frames <= 0 or stereo_sig.shape[0] == 0:
        return [0.0] * max(0, num_video_frames)
    mono_energy = 0.5 * (stereo_sig[:, 0] ** 2 + stereo_sig[:, 1] ** 2)
    edges = np.linspace(0, stereo_sig.shape[0], num_video_frames + 1, dtype=int)
    rms_vals: List[float] = []
    for i in range(num_video_frames):
        i0 = int(edges[i])
        i1 = max(i0 + 1, int(edges[i + 1]))
        rms_vals.append(float(np.sqrt(np.mean(mono_energy[i0:i1]))))

    arr = np.array(rms_vals, dtype=np.float32)
    p98 = float(np.percentile(arr, 98)) if arr.size else 1.0
    if p98 > 1e-6:
        arr = np.clip(arr / p98, 0.0, 1.0)
    return [round(float(v), 4) for v in arr]


# ============================================================================
# Renderizador Principal (Stems Secos + Mix Dry + Mix Wind)
# ============================================================================

def render_jukebox_audio(
    score: dict,
    output_dir: Path,
    enabled_layers: Optional[Iterable[str]] = None,
    wind_enabled: bool = True,
    temperature_color: bool = False,
    num_video_frames: int = 0,
    seamless_loop: bool = False,
    sr: int = SAMPLE_RATE,
) -> RenderedAudioBundle:
    """
    Renderiza apenas os instrumentos habilitados (`chords.wav`, `bass.wav`, `melody.wav`),
    soma-os exatamente em `mix_dry.wav` e aplica o bus linear de vento para gerar `mix_wind.wav`.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    active_session = score["session"]["active"]
    bpm = float(active_session["bpm"])
    total_bars = int(active_session["total_bars"])
    beat_sec = 60.0 / bpm
    loop_samples = int(round(total_bars * 4.0 * beat_sec * sr))

    if enabled_layers is None:
        active_insts = list(INSTRUMENT_LAYERS)
    else:
        active_insts = [k for k in INSTRUMENT_LAYERS if k in set(enabled_layers)]

    track_key_map = {
        "chords": "chords_pad",
        "bass": "bass",
        "melody": "melody",
    }

    stem_signals: Dict[str, np.ndarray] = {}
    stem_paths: Dict[str, Path] = {}
    frame_envelopes: Dict[str, List[float]] = {}

    for inst_id in active_insts:
        notes = score["tracks"][track_key_map[inst_id]]
        sp_notes = score["tracks"].get("melody_sparkle", []) if inst_id == "melody" else None
        stem_sig = render_instrument_stem(
            instrument_id=inst_id,
            notes=notes,
            bpm=bpm,
            total_bars=total_bars,
            seamless_loop=seamless_loop,
            sr=sr,
            sparkle_notes=sp_notes,
        )
        stem_signals[inst_id] = stem_sig
        wav_path = output_dir / f"{inst_id}.wav"
        write_pcm16_wav(stem_sig, wav_path, sr)
        stem_paths[inst_id] = wav_path
        if num_video_frames > 0:
            frame_envelopes[inst_id] = compute_frame_rms_envelope(stem_sig, num_video_frames)

    if stem_signals:
        mix_dry_raw = np.zeros((loop_samples, 2), dtype=np.float32)
        for inst_id in active_insts:
            mix_dry_raw += stem_signals[inst_id]
    else:
        mix_dry_raw = np.zeros((loop_samples, 2), dtype=np.float32)

    if temperature_color:
        temp_idx = float(score["session"]["region"].get("temperature_mean_index", 0.5))
        mix_dry_colored = apply_temperature_color_tilt(mix_dry_raw, temp_idx, sr)
    else:
        mix_dry_colored = mix_dry_raw

    mix_dry_out = soft_limit_master(mix_dry_colored)
    mix_dry_path = output_dir / "mix_dry.wav"
    write_pcm16_wav(mix_dry_out, mix_dry_path, sr)

    wind_params = score["musical_parameters"]["wind"]
    if wind_enabled:
        mix_wind_raw = apply_wind_bus(
            dry_stereo=mix_dry_out,
            wind_params=wind_params,
            bpm=bpm,
            seamless_loop=seamless_loop,
            sr=sr,
        )
        mix_wind_out = soft_limit_master(mix_wind_raw)
    else:
        mix_wind_out = mix_dry_out.copy()

    mix_wind_path = output_dir / "mix_wind.wav"
    write_pcm16_wav(mix_wind_out, mix_wind_path, sr)

    if num_video_frames > 0:
        for inst_id in INSTRUMENT_LAYERS:
            if inst_id not in frame_envelopes:
                frame_envelopes[inst_id] = [0.0] * num_video_frames
        frame_envelopes["mix_dry"] = compute_frame_rms_envelope(mix_dry_out, num_video_frames)
        frame_envelopes["mix_wind"] = compute_frame_rms_envelope(mix_wind_out, num_video_frames)
        wet_diff = mix_wind_out - mix_dry_out
        frame_envelopes["wind"] = compute_frame_rms_envelope(wet_diff, num_video_frames) if wind_enabled else [0.0] * num_video_frames
        frame_envelopes["temperature"] = [
            round(float(active_session.get("temperature_mean_index", 0.5)), 4)
        ] * num_video_frames

    active_mix_path = mix_wind_path if wind_enabled else mix_dry_path
    return RenderedAudioBundle(
        stem_paths=stem_paths,
        mix_dry_path=mix_dry_path,
        mix_wind_path=mix_wind_path,
        active_mix_path=active_mix_path,
        frame_envelopes=frame_envelopes,
        duration_seconds=round(loop_samples / sr, 3),
        sample_rate=sr,
    )
