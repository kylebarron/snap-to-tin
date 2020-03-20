// import { Feature } from "@types/geojson"
import Flatbush from "flatbush";
import uniqBy from "lodash.uniqby";
import orderBy from "lodash.orderby";
import {
  interpolateTriangle,
  interpolateEdge,
  lineTriangleIntersect2d,
  pointInTriangle2d
} from "./geom";
import { searchLineInIndex } from "./rtree";
import { Point, PointZ, FloatArray } from "./types";

// Find elevation of point
export function handlePoint(
  point: Point,
  index: Flatbush,
  triangles: FloatArray
): PointZ | null {
  // Search index for point
  const [x, y] = point.slice(0, 2);

  // array of TypedArrays of length 9
  const candidateTriangles = index
    .search(x, y, x, y)
    .map(i => triangles.subarray(i * 9, (i + 1) * 9));

  // Find true positives from rtree results
  // Since I'm working with triangles and not square boxes, it's possible that a point could be
  // inside the triangle's bounding box but outside the triangle itself.
  // array of TypedArrays of length 9
  const filteredResults = candidateTriangles.filter(result => {
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

// Add coordinates for LineString
export function handleLineString(
  line: Point[],
  index: Flatbush,
  triangles: FloatArray
) {
  let coordsWithZ = [];

  // Loop over each coordinate pair
  for (let i = 0; i < line.length - 1; i++) {
    const start = line[i];
    const end = line[i + 1];
    const sorted = handleLineSegment([start, end], index, triangles);

    const newStart = handlePoint(start, index, triangles);
    if (newStart) coordsWithZ.push(newStart);
    coordsWithZ.push.apply(sorted);
  }

  const endPoint = line.slice(-1)[0];
  const newEnd = handlePoint(endPoint, index, triangles);
  if (newEnd) coordsWithZ.push(newEnd);
  return coordsWithZ;
}

export function handleLineSegment(lineSegment, index, triangles) {
  const [start, end] = lineSegment;

  // Sometimes the start and end points can be the same, usually from clipping
  if (start[0] === end[0] && start[1] === end[1]) return;

  // Find edges that this line segment crosses
  // First search in rtree. This is fast but has false-positives
  // array of TypedArrays of length 9
  const results = searchLineInIndex({ line: lineSegment, index }).map(i =>
    triangles.subarray(i * 9, (i + 1) * 9)
  );

  // Find points where line crosses edges
  // intersectionPoints is Array([x, y, z])
  // Note that intersectionPoints has 2x duplicates!
  // This is because every edge crossed is part of two triangles!
  const intersectionPoints = results.flatMap(triangle => {
    // Rename:
    const intersectionPoints = lineTriangleIntersect2d(lineSegment, triangle);
    if (!intersectionPoints || intersectionPoints.length === 0) return [];

    // Otherwise, has an intersection point(s)
    const newPoints = [];
    for (const intersectionPoint of intersectionPoints) {
      const newPoint = interpolateEdge(triangle, intersectionPoint);
      newPoints.push(newPoint);
    }

    return newPoints;
  });

  // Quick and dirty deduplication
  // Since interpolateTriangle appears to be working now, this just deduplicates on the first
  // element.
  const uniqCoords = uniqBy(intersectionPoints, x => x[0]);

  // sort points in order from start to end
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  let sorted;
  if (deltaX > 0) {
    sorted = orderBy(uniqCoords, c => c[0], "asc");
  } else if (deltaX < 0) {
    sorted = orderBy(uniqCoords, c => c[0], "desc");
  } else if (deltaY > 0) {
    sorted = orderBy(uniqCoords, c => c[1], "asc");
  } else if (deltaY < 0) {
    sorted = orderBy(uniqCoords, c => c[1], "desc");
  } else {
    throw new Error("start and end point same???");
  }
  return sorted;
}
