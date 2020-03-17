import Flatbush from "flatbush";
import { interpolateTriangle, pointInTriangle2d } from "./geom";
import { Point, PointZ } from "./types";

// Find elevation of point
export function handlePoint(
  point: Point,
  index: Flatbush,
  triangles: Float32Array
): PointZ | null {
  // Search index for point
  const [x, y] = point.slice(0, 2);
  // array of TypedArrays of length 9
  const results = index
    .search(x, y, x, y)
    .map(i => triangles.subarray(i * 9, (i + 1) * 9));

  // Find true positives from rtree results
  // Since I'm working with triangles and not square boxes, it's possible that a point could be
  // inside the triangle's bounding box but outside the triangle itself.
  // array of TypedArrays of length 9
  const filteredResults = results.filter(result => {
    if (pointInTriangle2d(point, result)) return result;
  });

  // Not sure why this is sometimes empty after filtering??
  if (filteredResults.length === 0) {
    return null;
  }

  // Now linearly interpolate elevation within this triangle
  // TypedArray of length 9
  const triangle = filteredResults[0];
  return interpolateTriangle(point, triangle);
}
