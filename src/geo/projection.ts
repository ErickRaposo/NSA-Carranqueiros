import * as THREE from 'three';

export const GLOBE_RADIUS = 1;
export const FLAT_WIDTH = Math.PI * 2 * GLOBE_RADIUS;
export const FLAT_HEIGHT = Math.PI * GLOBE_RADIUS;

export interface LonLat {
  lon: number;
  lat: number;
}

/**
 * Converts geographic coordinates (degrees) to 3D sphere coordinates (Y-up, +Z at Prime Meridian).
 * lon = 0, lat = 0 -> (0, 0, R)
 * lon = +90E, lat = 0 -> (+R, 0, 0)
 * lon = -90W, lat = 0 -> (-R, 0, 0)
 * lat = +90N -> (0, +R, 0)
 */
export function lonLatToSphere(
  lonDeg: number,
  latDeg: number,
  radius = GLOBE_RADIUS
): THREE.Vector3 {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const x = radius * cosLat * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.cos(lonRad);
  return new THREE.Vector3(x, y, z);
}

/**
 * Converts geographic coordinates (degrees) to 2D equirectangular plane coordinates.
 */
export function lonLatToFlat(
  lonDeg: number,
  latDeg: number,
  width = FLAT_WIDTH,
  height = FLAT_HEIGHT,
  zOffset = 0
): THREE.Vector3 {
  const x = (lonDeg / 180) * (width * 0.5);
  const y = (latDeg / 90) * (height * 0.5);
  return new THREE.Vector3(x, y, zOffset);
}

/**
 * Converts geographic coordinates to equirectangular UV coordinates [0..1].
 */
export function lonLatToUV(lonDeg: number, latDeg: number): { u: number; v: number } {
  return {
    u: (lonDeg + 180) / 360,
    v: (latDeg + 90) / 180,
  };
}

/**
 * Converts a 3D point on the sphere back to geographic coordinates (degrees).
 */
export function spherePointToLonLat(point: THREE.Vector3): LonLat {
  const len = point.length();
  if (len === 0) return { lon: 0, lat: 0 };
  const ny = THREE.MathUtils.clamp(point.y / len, -1, 1);
  const lat = (Math.asin(ny) * 180) / Math.PI;
  const lon = (Math.atan2(point.x, point.z) * 180) / Math.PI;
  return { lon, lat };
}

/**
 * Converts a 2D point on the equirectangular plane back to geographic coordinates (degrees).
 */
export function flatPointToLonLat(
  point: THREE.Vector3,
  width = FLAT_WIDTH,
  height = FLAT_HEIGHT
): LonLat {
  const lon = THREE.MathUtils.clamp((point.x / (width * 0.5)) * 180, -180, 180);
  const lat = THREE.MathUtils.clamp((point.y / (height * 0.5)) * 90, -90, 90);
  return { lon, lat };
}

export function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
}

/**
 * Builds a BufferGeometry capable of smoothly morphing between a 3D sphere (`position`)
 * and a 2D equirectangular plane (`aFlatPosition`) with aligned UVs.
 */
export function buildMorphEarthGeometry(
  lonSegments = 128,
  latSegments = 64,
  radius = GLOBE_RADIUS,
  flatWidth = FLAT_WIDTH,
  flatHeight = FLAT_HEIGHT
): THREE.BufferGeometry {
  const cols = lonSegments + 1;
  const rows = latSegments + 1;
  const vertexCount = cols * rows;

  const positions = new Float32Array(vertexCount * 3);
  const flatPositions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let ptr3 = 0;
  let ptr2 = 0;

  for (let iy = 0; iy < rows; iy++) {
    const v = iy / latSegments; // 0 (South Pole) -> 1 (North Pole)
    const lat = v * 180 - 90;

    for (let ix = 0; ix < cols; ix++) {
      const u = ix / lonSegments; // 0 (-180) -> 1 (+180)
      const lon = u * 360 - 180;

      const p3 = lonLatToSphere(lon, lat, radius);
      const p2 = lonLatToFlat(lon, lat, flatWidth, flatHeight, 0);
      const n3 = p3.clone().normalize();

      positions[ptr3] = p3.x;
      positions[ptr3 + 1] = p3.y;
      positions[ptr3 + 2] = p3.z;

      flatPositions[ptr3] = p2.x;
      flatPositions[ptr3 + 1] = p2.y;
      flatPositions[ptr3 + 2] = p2.z;

      normals[ptr3] = n3.x;
      normals[ptr3 + 1] = n3.y;
      normals[ptr3 + 2] = n3.z;

      uvs[ptr2] = u;
      uvs[ptr2 + 1] = v;

      ptr3 += 3;
      ptr2 += 2;
    }
  }

  const indices: number[] = [];
  for (let iy = 0; iy < latSegments; iy++) {
    for (let ix = 0; ix < lonSegments; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = (iy + 1) * cols + ix;
      const d = c + 1;
      // Counter-clockwise winding viewed from outside (+Z / +normal)
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aFlatPosition', new THREE.BufferAttribute(flatPositions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export interface GeoRingCoordinates {
  rings: number[][][];
}

/**
 * Builds morphable line segments (3D sphere + 2D flat) from polygon rings,
 * skipping segments that cross the antimeridian (|dlon| > 180°) to avoid horizontal artifacts.
 */
export function buildMorphLinesFromRings(
  rings: number[][][],
  radius = GLOBE_RADIUS * 1.003,
  flatWidth = FLAT_WIDTH,
  flatHeight = FLAT_HEIGHT,
  flatZ = 0.004
): THREE.BufferGeometry {
  const pos3: number[] = [];
  const pos2: number[] = [];

  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];

      // Avoid antimeridian wrap lines in 2D and distorted long jumps
      if (Math.abs(lon2 - lon1) > 180) continue;

      const s1 = lonLatToSphere(lon1, lat1, radius);
      const s2 = lonLatToSphere(lon2, lat2, radius);
      const f1 = lonLatToFlat(lon1, lat1, flatWidth, flatHeight, flatZ);
      const f2 = lonLatToFlat(lon2, lat2, flatWidth, flatHeight, flatZ);

      pos3.push(s1.x, s1.y, s1.z, s2.x, s2.y, s2.z);
      pos2.push(f1.x, f1.y, f1.z, f2.x, f2.y, f2.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3));
  geometry.setAttribute('aFlatPosition', new THREE.Float32BufferAttribute(pos2, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds morphable graticule (latitude/longitude reference grid) lines.
 */
export function buildMorphGraticuleGeometry(
  lonStep = 30,
  latStep = 15,
  radius = GLOBE_RADIUS * 1.0018,
  flatWidth = FLAT_WIDTH,
  flatHeight = FLAT_HEIGHT,
  flatZ = 0.002
): THREE.BufferGeometry {
  const rings: number[][][] = [];

  for (let lat = -75; lat <= 75; lat += latStep) {
    const line: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      line.push([lon, lat]);
    }
    rings.push(line);
  }

  for (let lon = -180; lon <= 180; lon += lonStep) {
    const line: number[][] = [];
    for (let lat = -88; lat <= 88; lat += 4) {
      line.push([lon, lat]);
    }
    rings.push(line);
  }

  return buildMorphLinesFromRings(rings, radius, flatWidth, flatHeight, flatZ);
}
