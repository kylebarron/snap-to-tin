import barycentric from "barycentric";
import { PointZ, Point, Triangle, TriangleZ, LineSegment } from "./types";

// a, b, c must be arrays of three elements
// point must be an array of two elements
// TODO: add tests where you assert that the interpolated z is above the min vertex height and below
// the max vertex height
export function interpolateTriangle(
  a: PointZ,
  b: PointZ,
  c: PointZ,
  point: Point
): PointZ {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  const [cx, cy, cz] = c;

  // Find the mix of a, b, and c to use
  const mix: number[] = barycentric(
    [
      [ax, ay],
      [bx, by],
      [cx, cy]
    ],
    point.slice(0, 2)
  );

  // Find the correct z based on that mix
  const interpolatedZ = mix[0] * az + mix[1] * bz + mix[2] * cz;

  return [point[0], point[1], interpolatedZ];
}

/**
 * Interpolate when point is known to be on triangle edge
 * Can be much faster than working with barycentric coordinates
 */
export function interpolateEdge(triangle: TriangleZ, point: Point): PointZ {
  // loop over each edge until you find one where the point is on the line
  for (let i = 0; i < triangle.length - 1; i++) {
    const start = triangle[i];
    const end = triangle[i + 1];

    const onLine = pointOnLine(start, end, point);
    if (!onLine) continue;

    // percent distance from start to end
    const pctAlong = distanceLine(start, point) / distanceLine(start, end);
    const z = start[2] + pctAlong * (end[2] - start[2]);
    return [point[0], point[1], z];
  }
}

// https://stackoverflow.com/a/11912171
function pointOnLine(
  a: Point | PointZ,
  b: Point | PointZ,
  point: Point | PointZ
): boolean {
  return floatIsClose(
    distanceLine(a, point) + distanceLine(b, point) - distanceLine(a, b),
    0
  );
}

function distanceLine(a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function floatIsClose(a: number, b: number, eps: number = 1e-10): boolean {
  return Math.abs(a - b) < eps;
}

// Modfied slightly from https://stackoverflow.com/a/24392281
// returns intersection point if the line from a->b intersects with c->d
// Otherwise returns false
function lineLineIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point
): Point | boolean {
  // ∆x1 * ∆y2 - ∆x2 * ∆y1
  const det = (b[0] - a[0]) * (d[1] - c[1]) - (d[0] - c[0]) * (b[1] - a[1]);
  if (det === 0) {
    // NOTE: lines are parallel
    return false;
  }

  // pct distance along each line
  const lambda =
    ((d[1] - c[1]) * (d[0] - a[0]) + (c[0] - d[0]) * (d[1] - a[1])) / det;
  const gamma =
    ((a[1] - b[1]) * (d[0] - a[0]) + (b[0] - a[0]) * (d[1] - a[1])) / det;
  if (!(0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1)) {
    // intersects outside the line segments
    return false;
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

// line is [a, b]
// triangle is [x, y, z, x]
// where all of the above are 2-tuples
// Test line-line intersection among line and each edge of the triangle
export function lineTriangleIntersect(
  line: LineSegment,
  triangle: Triangle
): Point[] {
  // loop over each edge
  const intersectionPoints = [];
  for (let i = 0; i < triangle.length - 1; i++) {
    const edge = [triangle[i], triangle[i + 1]];
    const intersectionPoint = lineLineIntersection(
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
