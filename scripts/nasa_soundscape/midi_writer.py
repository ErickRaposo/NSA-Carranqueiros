"""
Exportador MIDI Multi-Pista (Standard MIDI File Format 1) em Python puro para o Earth Jukebox.
Exporta os 3 instrumentos (`melody`, `chords`, `bass`) respeitando as camadas habilitadas.
"""

from pathlib import Path
import struct
from typing import Iterable, List, Optional, Tuple

from .config import INSTRUMENT_LAYERS

TICKS_PER_BEAT = 480


def _encode_vlq(value: int) -> bytes:
    value = max(0, int(value))
    buf = [value & 0x7F]
    value >>= 7
    while value > 0:
        buf.append((value & 0x7F) | 0x80)
        value >>= 7
    buf.reverse()
    return bytes(buf)


def _build_track_chunk(abs_events: List[Tuple[int, int, bytes]], track_name: str) -> bytes:
    name_bytes = track_name.encode("utf-8", errors="ignore")
    all_events: List[Tuple[int, int, bytes]] = [
        (0, 0, b"\xFF\x03" + _encode_vlq(len(name_bytes)) + name_bytes)
    ]
    all_events.extend(abs_events)
    all_events.sort(key=lambda item: (item[0], item[1]))

    body = bytearray()
    last_tick = 0
    for tick, _, payload in all_events:
        delta = max(0, tick - last_tick)
        body.extend(_encode_vlq(delta))
        body.extend(payload)
        last_tick = tick

    body.extend(_encode_vlq(4))
    body.extend(b"\xFF\x2F\x00")
    return b"MTrk" + struct.pack(">I", len(body)) + bytes(body)


def export_score_to_midi(
    score: dict,
    out_path: Path,
    enabled_layers: Optional[Iterable[str]] = None,
    wind_enabled: bool = True,
) -> Path:
    """Exporta a partitura dos instrumentos ativos para arquivo `.mid`."""
    active_s = score["session"]["active"]
    bpm = int(active_s["bpm"])
    mpqn = int(round(60_000_000 / max(1, bpm)))
    enabled_set = set(INSTRUMENT_LAYERS if enabled_layers is None else enabled_layers)

    tracks_chunks: List[bytes] = []
    tempo_bytes = mpqn.to_bytes(3, byteorder="big")
    meta_events = [
        (0, 1, b"\xFF\x58\x04\x04\x02\x18\x08"),
        (0, 2, b"\xFF\x51\x03" + tempo_bytes),
    ]
    tracks_chunks.append(_build_track_chunk(meta_events, "Earth Jukebox Session Master"))

    def notes_to_track(
        notes: List[dict], channel: int, program: int, track_name: str, reverb_cc: int = 48
    ) -> bytes:
        evs: List[Tuple[int, int, bytes]] = [
            (0, 1, bytes([0xC0 | channel, program & 0x7F])),
            (0, 2, bytes([0xB0 | channel, 91, min(127, reverb_cc)])),
        ]
        for n in notes:
            start_tick = int(round(float(n["start_beat"]) * TICKS_PER_BEAT))
            dur_tick = max(20, int(round(float(n["duration_beats"]) * TICKS_PER_BEAT)))
            end_tick = start_tick + dur_tick
            pitch = max(0, min(127, int(n["pitch"])))
            vel = max(1, min(127, int(round(float(n["velocity"]) * 127.0))))
            evs.append((start_tick, 20, bytes([0x90 | channel, pitch, vel])))
            evs.append((end_tick, 10, bytes([0x80 | channel, pitch, 0])))
        return _build_track_chunk(evs, track_name)

    reverb_cc = (
        int(round(score["musical_parameters"]["wind"]["reverb_wet_mix"] * 127))
        if wind_enabled
        else 0
    )

    if "melody" in enabled_set:
        tracks_chunks.append(
            notes_to_track(
                score["tracks"]["melody"],
                channel=0,
                program=11,
                track_name="Melody - ISS Lightning (Main)",
                reverb_cc=reverb_cc,
            )
        )
        sparkle_notes = score["tracks"].get("melody_sparkle", [])
        if sparkle_notes:
            tracks_chunks.append(
                notes_to_track(
                    sparkle_notes,
                    channel=3,
                    program=8,
                    track_name="Melody Sparkle - Storm Density (5th/8ve + Shimmer)",
                    reverb_cc=min(127, reverb_cc + 18),
                )
            )
    if "chords" in enabled_set:
        tracks_chunks.append(
            notes_to_track(
                score["tracks"]["chords_pad"],
                channel=1,
                program=89,
                track_name="Chords - CO",
                reverb_cc=reverb_cc,
            )
        )
    if "bass" in enabled_set:
        tracks_chunks.append(
            notes_to_track(
                score["tracks"]["bass"],
                channel=2,
                program=38,
                track_name="Bass - NO2",
                reverb_cc=max(0, reverb_cc // 3),
            )
        )

    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks_chunks), TICKS_PER_BEAT)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as fp:
        fp.write(header)
        for chunk in tracks_chunks:
            fp.write(chunk)
    return out_path
