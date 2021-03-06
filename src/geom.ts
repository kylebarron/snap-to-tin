import { PointZ, Point, TriangleZ, LineSegment, FloatArray } from "./types";

export function interpolateTriangle(
  point: Point,
  triangle: TriangleZ
): PointZ | null {
  const az = triangle[2];
  const bz = triangle[5];
  const cz = triangle[8];

  // Find the mix of a, b, and c to use
  const mix: number[] = barycentric2d(point, triangle);

  // If point is outside triangle, return null
  if (
    mix[0] < 0 ||
    1 < mix[0] ||
    mix[1] < 0 ||
    1 < mix[1] ||
    mix[2] < 0 ||
    1 < mix[2]
  ) {
    return null;
  }

  // Find the correct z based on that mix
  const interpolatedZ = mix[0] * az + mix[1] * bz + mix[2] * cz;

  return [point[0], point[1], interpolatedZ];
}

// Interpolate when point is known to be on triangle edge
// Can be much faster than working with barycentric coordinates
export function interpolateEdge(
  triangle: TriangleZ,
  point: Point
): PointZ | null {
  // loop over each edge until you find one where the point is on the line
  for (const edge of triangleToEdges(triangle)) {
    const start = edge[0];
    const end = edge[1];

    const onLine = pointOnLine2d(start, end, point);
    if (!onLine) continue;

    // percent distance from start to end
    const pctAlong = distanceLine2d(start, point) / distanceLine2d(start, end);
    const z = start[2] + pctAlong * (end[2] - start[2]);
    return [point[0], point[1], z];
  }

  return null;
}

// https://stackoverflow.com/a/11912171
export function pointOnLine2d(
  a: Point | PointZ,
  b: Point | PointZ,
  point: Point | PointZ
): boolean {
  return floatIsClose(
    distanceLine2d(a, point) + distanceLine2d(b, point) - distanceLine2d(a, b),
    0
  );
}

export function distanceLine2d(a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

export function floatIsClose(
  a: number,
  b: number,
  eps: number = 1e-10
): boolean {
  return Math.abs(a - b) < eps;
}

// Modfied slightly from https://stackoverflow.com/a/24392281
// returns intersection point if the line from a->b intersects with c->d
// Otherwise returns false
export function lineLineIntersection2d(
  a: Point,
  b: Point,
  c: Point,
  d: Point
): Point | null {
  // ∆x1 * ∆y2 - ∆x2 * ∆y1
  const det = (b[0] - a[0]) * (d[1] - c[1]) - (d[0] - c[0]) * (b[1] - a[1]);
  if (det === 0) {
    // NOTE: lines are parallel
    return null;
  }

  // pct distance along each line
  const lambda =
    ((d[1] - c[1]) * (d[0] - a[0]) + (c[0] - d[0]) * (d[1] - a[1])) / det;
  const gamma =
    ((a[1] - b[1]) * (d[0] - a[0]) + (b[0] - a[0]) * (d[1] - a[1])) / det;
  if (!(0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1)) {
    // intersects outside the line segments
    return null;
  }

  // With the current implementation, lambda is correctly the percent distance along the first line
  // from a to b, but gamma is the percent distance **back** from d to c It isn't worth my time to
  // figure out how to change the function, but just keep that in mind.

  // Find intersection point
  // Use lambda for pct along a-b
  const x = a[0] + lambda * (b[0] - a[0]);
  const y = a[1] + lambda * (b[1] - a[1]);
  return [x, y];
}

// Test line-line intersection among line and each edge of the triangle
export function lineTriangleIntersect2d(
  line: LineSegment,
  triangle: TriangleZ
): Point[] {
  // loop over each edge
  const intersectionPoints: Point[] = [];
  for (const edge of triangleToEdges(triangle)) {
    const intersectionPoint = lineLineIntersection2d(
      line[0],
      line[1],
      edge[0],
      edge[1]
    );
    if (intersectionPoint) {
      intersectionPoints.push(intersectionPoint);
    }
  }
  return intersectionPoints;
}

export function* triangleToEdges(triangle: TriangleZ) {
  for (let i = 0; i < 3; i++) {
    let edge: FloatArray[] = [];
    if (i === 0) {
      edge.push(triangleVertex(0, triangle));
      edge.push(triangleVertex(1, triangle));
    } else if (i === 1) {
      edge.push(triangleVertex(1, triangle));
      edge.push(triangleVertex(2, triangle));
    } else if (i === 2) {
      edge.push(triangleVertex(2, triangle));
      edge.push(triangleVertex(0, triangle));
    }
    yield edge;
  }
}

export function triangleVertex(i: number, triangle: TriangleZ) {
  return triangle.subarray(i * 3, (i + 1) * 3);
}

// Split line into desired number of segments
export function splitLine2d(
  line: LineSegment,
  nSegments: number
): LineSegment[] {
  const [start, end] = line;
  const lineSegments: LineSegment[] = [];

  for (let i = 0; i < nSegments; i++) {
    // _i_th part of the way from min to max
    const a = start[0] + (i / nSegments) * (end[0] - start[0]);
    const b = start[1] + (i / nSegments) * (end[1] - start[1]);
    const c = start[0] + ((i + 1) / nSegments) * (end[0] - start[0]);
    const d = start[1] + ((i + 1) / nSegments) * (end[1] - start[1]);
    lineSegments.push([
      [a, b],
      [c, d]
    ]);
  }

  return lineSegments;
}

export function triangleToBounds(triangle: TriangleZ): number[] {
  if (triangle.length !== 9) {
    throw new Error(`Incorrect length of triangle: ${triangle.length}`);
  }

  const minX = Math.min(triangle[0], triangle[3], triangle[6]);
  const maxX = Math.max(triangle[0], triangle[3], triangle[6]);
  const minY = Math.min(triangle[1], triangle[4], triangle[7]);
  const maxY = Math.max(triangle[1], triangle[4], triangle[7]);
  return [minX, minY, maxX, maxY];
}

export function pointInTriangle2d(
  p: Point | PointZ,
  triangle: TriangleZ
): boolean {
  const [x, y, z] = barycentric2d(p, triangle);
  return x >= 0 && y >= 0 && z >= 0;
}

// From https://stackoverflow.com/a/14382692
export function barycentric2d(
  p: Point | PointZ,
  triangle: TriangleZ
): number[] {
  const p0 = triangle.subarray(0, 3);
  const p1 = triangle.subarray(3, 6);
  const p2 = triangle.subarray(6, 9);

  const area =
    0.5 *
    (-p1[1] * p2[0] +
      p0[1] * (-p1[0] + p2[0]) +
      p0[0] * (p1[1] - p2[1]) +
      p1[0] * p2[1]);

  const s =
    (1 / (2 * area)) *
    (p0[1] * p2[0] -
      p0[0] * p2[1] +
      (p2[1] - p0[1]) * p[0] +
      (p0[0] - p2[0]) * p[1]);
  const t =
    (1 / (2 * area)) *
    (p0[0] * p1[1] -
      p0[1] * p1[0] +
      (p0[1] - p1[1]) * p[0] +
      (p1[0] - p0[0]) * p[1]);

  return [1 - s - t, s, t];
}
