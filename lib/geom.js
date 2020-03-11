import barycentric from "barycentric";

// a, b, c must be arrays of three elements
// point must be an array of two elements
// TODO: add tests where you assert that the interpolated z is above the min vertex height and below
// the max vertex height
export function interpolateTriangle(a, b, c, point) {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  const [cx, cy, cz] = c;

  // Find the mix of a, b, and c to use
  const mix = barycentric(
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

// Interpolate when point is known to be on triangle edge
// Can be much faster than working with barycentric coordinates
// triangle is [a, b, c, d], where each vertex is (x, y, z)
// point is (x, y)
export function interpolateEdge(triangle, point) {
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
function pointOnLine(a, b, point) {
  return floatIsClose(
    distanceLine(a, point) + distanceLine(b, point) - distanceLine(a, b),
    0
  );
}

function distanceLine(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function floatIsClose(a, b, eps = 1e-10) {
  return Math.abs(a - b) < eps;
}
