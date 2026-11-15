/**
 * Gerador QR Code ISO/IEC 18004 nativo em TypeScript puro (Offline-First, Zero Dependências).
 * Suporta URLs de até 106 bytes (Versões 1 a 5, Nível L, Byte Mode).
 */

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignmentCenters: number[];
}

const VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignmentCenters: [6, 30] },
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

function computeFormatBits(ecLevelBits: number, maskPattern: number): number {
  const data = ((ecLevelBits & 0x3) << 3) | (maskPattern & 0x7);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  // Byte mode: 4 bits mode (0100) + 8 bits length + payload + up to 4 terminator bits
  const spec =
    VERSION_SPECS_L.find((s) => utf8.length + 2 <= s.dataCodewords) ??
    VERSION_SPECS_L[VERSION_SPECS_L.length - 1];

  const payload = utf8.slice(0, spec.dataCodewords - 2);
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, 8);
  for (const byte of payload) {
    pushBits(byte, 8);
  }

  const maxDataBits = spec.dataCodewords * 8;
  const termCount = Math.min(4, maxDataBits - bits.length);
  pushBits(0, termCount);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    dataBytes[i] = padIdx % 2 === 0 ? 0xec : 0x11;
    padIdx++;
  }

  const ecBytes = reedSolomonComputeRemainder(dataBytes, spec.ecCodewords);
  const allCodewords = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
  allCodewords.set(dataBytes, 0);
  allCodewords.set(ecBytes, spec.dataCodewords);

  const n = spec.size;
  const modules: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const isFunction: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

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

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

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

  // Reserve format info modules + dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][n - 1 - i] = true;
    isFunction[n - 1 - i][8] = true;
  }
  setFunc(n - 8, 8, true); // Dark module

  // Zigzag placement of data + EC bits
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
        // Apply Mask Pattern 0: (r + c) % 2 === 0
        if ((r + c) % 2 === 0) dark = !dark;
        modules[r][c] = dark;
      }
    }
    upward = !upward;
  }

  // Write Format Bits (Level L = 0b01, Mask = 0)
  const formatBits = computeFormatBits(0b01, 0);
  for (let i = 0; i <= 5; i++) setFunc(8, i, ((formatBits >> i) & 1) === 1);
  setFunc(8, 7, ((formatBits >> 6) & 1) === 1);
  setFunc(8, 8, ((formatBits >> 7) & 1) === 1);
  setFunc(7, 8, ((formatBits >> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((formatBits >> i) & 1) === 1);

  for (let i = 0; i < 8; i++) setFunc(n - 1 - i, 8, ((formatBits >> i) & 1) === 1);
  for (let i = 8; i < 15; i++) setFunc(8, n - 15 + i, ((formatBits >> i) & 1) === 1);

  return modules;
}
