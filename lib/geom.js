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
