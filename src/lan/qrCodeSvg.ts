/**
 * Native ISO/IEC 18004 QR Code generator in pure TypeScript (Offline-First, Zero Dependencies).
 * Supports URLs up to 271 UTF-8 bytes (Versions 1 to 10, Level L, Byte Mode, Multi-Block RS + Auto-Mask 0..7).
 */

interface QrVersionSpec {
  version: number;
  size: number;
  totalDataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignmentCenters: number[];
}

const VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, size: 21, totalDataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, totalDataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, totalDataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, totalDataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCenters: [6, 26] },
  { version: 5, size: 37, totalDataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenters: [6, 30] },
  { version: 6, size: 41, totalDataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenters: [6, 34] },
  { version: 7, size: 45, totalDataCodewords: 156, ecCodewordsPerBlock: 20, numBlocks: 2, alignmentCenters: [6, 22, 38] },
  { version: 8, size: 49, totalDataCodewords: 194, ecCodewordsPerBlock: 24, numBlocks: 2, alignmentCenters: [6, 24, 42] },
  { version: 9, size: 53, totalDataCodewords: 232, ecCodewordsPerBlock: 30, numBlocks: 2, alignmentCenters: [6, 26, 46] },
  { version: 10, size: 57, totalDataCodewords: 274, ecCodewordsPerBlock: 18, numBlocks: 4, alignmentCenters: [6, 28, 50] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function reedSolomonGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function reedSolomonComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = reedSolomonGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

export function computeFormatBits(ecLevelBits: number, maskPattern: number): number {
  const data = ((ecLevelBits & 0x3) << 3) | (maskPattern & 0x7);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

function getBit(val: number, idx: number): boolean {
  return ((val >>> idx) & 1) === 1;
}

function evaluateMaskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function writeFormatBitsToMatrix(
  modules: boolean[][],
  isFunction: boolean[][],
  ecLevelBits: number,
  mask: number
): void {
  const n = modules.length;
  const formatBits = computeFormatBits(ecLevelBits, mask);

  const setF = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Copy 1 around the top-left Finder:
  // LSB (bit 0) at (0, 8) -> MSB (bit 14) at (8, 0)
  for (let i = 0; i <= 5; i++) setF(i, 8, getBit(formatBits, i));
  setF(7, 8, getBit(formatBits, 6));
  setF(8, 8, getBit(formatBits, 7));
  setF(8, 7, getBit(formatBits, 8));
  for (let i = 9; i < 15; i++) setF(8, 14 - i, getBit(formatBits, i));

  // Copy 2: bits 0..7 on row 8 below the top-right Finder;
  // bits 8..14 on column 8 next to the bottom-left Finder (preserving Dark Module at (n - 8, 8))
  for (let i = 0; i < 8; i++) setF(8, n - 1 - i, getBit(formatBits, i));
  for (let i = 8; i < 15; i++) setF(n - 15 + i, 8, getBit(formatBits, i));
  setF(n - 8, 8, true);
}

function computePenaltyScore(modules: boolean[][]): number {
  const n = modules.length;
  let score = 0;

  // Rule 1: 5+ consecutive modules of the same color in rows and columns
  for (let r = 0; r < n; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of the same color
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (modules[r][c + 1] === v && modules[r + 1][c] === v && modules[r + 1][c + 1] === v) {
        score += 3;
      }
    }
  }

  // Rule 4: balance between dark and light modules
  let darkCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) darkCount++;
    }
  }
  const total = n * n;
  const k = Math.ceil((Math.abs(darkCount * 20 - total * 10) + total - 1) / total) - 1;
  score += Math.max(0, k) * 10;

  return score;
}

function interleaveBlocks(dataBytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const numBlocks = spec.numBlocks;
  const shortBlockLen = Math.floor(spec.totalDataCodewords / numBlocks);
  const numLongBlocks = spec.totalDataCodewords % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockLen = shortBlockLen + (b >= numShortBlocks ? 1 : 0);
    const blockData = dataBytes.subarray(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(blockData);
    ecBlocks.push(reedSolomonComputeRemainder(blockData, spec.ecCodewordsPerBlock));
  }

  const totalLen = spec.totalDataCodewords + numBlocks * spec.ecCodewordsPerBlock;
  const result = new Uint8Array(totalLen);
  let outIdx = 0;

  const maxDataLen = shortBlockLen + (numLongBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        result[outIdx++] = dataBlocks[b][i];
      }
    }
  }

  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      result[outIdx++] = ecBlocks[b][i];
    }
  }

  return result;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);

  // Versions 1..9 use 8 bits for length in Byte Mode (+2 bytes overhead); Version 10+ uses 16 bits (+3 bytes overhead)
  const spec =
    VERSION_SPECS_L.find((s) => {
      const headerOverheadBytes = s.version >= 10 ? 3 : 2;
      return utf8.length + headerOverheadBytes <= s.totalDataCodewords;
    }) ?? VERSION_SPECS_L[VERSION_SPECS_L.length - 1];

  const countIndicatorBits = spec.version >= 10 ? 16 : 8;
  const maxPayloadBytes = spec.totalDataCodewords - (spec.version >= 10 ? 3 : 2);
  const payload = utf8.slice(0, maxPayloadBytes);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, countIndicatorBits);
  for (const byte of payload) {
    pushBits(byte, 8);
  }

  const maxDataBits = spec.totalDataCodewords * 8;
  const termCount = Math.min(4, maxDataBits - bits.length);
  pushBits(0, termCount);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.totalDataCodewords; i++) {
    dataBytes[i] = padIdx % 2 === 0 ? 0xec : 0x11;
    padIdx++;
  }

  const allCodewords = interleaveBlocks(dataBytes, spec);

  const n = spec.size;
  const baseModules: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const isFunction: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    baseModules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Finder patterns (7x7 + 1px white separator)
  const drawFinder = (topR: number, leftC: number) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dist === 3 || dist <= 1);
        setFunc(topR + dy, leftC + dx, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (const cy of centers) {
    for (const cx of centers) {
      const overlapsFinder =
        (cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunc(cy + dy, cx + dx, dist !== 1);
        }
      }
    }
  }

  // Version Information (Versions >= 7 have two 6x3 blocks)
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = getBit(vBits, i);
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(b, a, bit);
      setFunc(a, b, bit);
    }
  }

  // Reserve Format Info + Dark Module cells before zigzag placement
  writeFormatBitsToMatrix(baseModules, isFunction, 0b01, 0);

  // Zigzag placement of codewords (data + EC) without initial mask
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;

  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      const r = upward ? n - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (isFunction[r][c]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          const byte = allCodewords[bitIdx >> 3];
          dark = ((byte >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        baseModules[r][c] = dark;
      }
    }
    upward = !upward;
  }

  // Automatically select the best mask (0..7) according to ISO/IEC 18004 penalty
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestMatrix: boolean[][] = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row) => [...row]);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!isFunction[r][c] && evaluateMaskCondition(mask, r, c)) {
          candidate[r][c] = !candidate[r][c];
        }
      }
    }
    writeFormatBitsToMatrix(candidate, isFunction, 0b01, mask);
    const penalty = computePenaltyScore(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }

  // Ensure final format bits for bestMask
  writeFormatBitsToMatrix(bestMatrix, isFunction, 0b01, bestMask);
  return bestMatrix;
}
