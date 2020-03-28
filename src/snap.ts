// import { Feature } from "@types/geojson"
import Flatbush from "flatbush";
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
  // Since I'm working with triangles and not square boxes, it's possible that a
  // point could be inside the triangle's bounding box but outside the triangle
  // itself.
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
//
// Note: you can't instantiate a new TypedArray with the number of
// coordinates, because you don't know how many edges you'll be
// crossing on the mesh
//
// For now I'll just return an array of arrays of coordinates
//
// But keep in mind you could do a two-pass approach:
// First loop over each line segment, searching the rtree index for each.
// Create an array of arrays of indexes that correspond to each segment.
// That gives you an upper bound to the number of triangles, so you could create
// a TypedArray using that upper bound
export function handleLineString(
  line: Point[],
  index: Flatbush,
  triangles: FloatArray
): PointZ[] {
  const nCoords = line.length;
  const newCoords: PointZ[] = [];

  // Loop over each coordinate pair
  for (let i = 0; i < nCoords - 1; i++) {
    const start = line[i];
    const end = line[i + 1];

    // Find z value of beginning endpoint of line segment
    const newStart = handlePoint(start, index, triangles);
    if (newStart) {
      newCoords.push(newStart);
    }

    // Find intermediate points of line segment
    const lineZ = handleLineSegment([start, end], index, triangles);
    if (lineZ) {
      for (const coord of lineZ) {
        newCoords.push(coord);
      }
    }
  }

  // Find z value of endpoint of polyline
  const endPoint = line[line.length - 1];
  const newEnd = handlePoint(endPoint, index, triangles);
  if (newEnd) {
    newCoords.push(newEnd);
  }

  // Return view on filled elements
  return newCoords;
}

// Find intersections between line segment and triangle edges
// This does not handle line segment endpoints
export function handleLineSegment(
  lineSegment: Point[],
  index: Flatbush,
  triangles: FloatArray
): PointZ[] | null {
  const [start, end] = lineSegment;

  // Sometimes the start and end points can be the same, usually from clipping
  if (start[0] === end[0] && start[1] === end[1]) return null;

  // Find edges that this line segment crosses
  // First search in rtree. This is fast but has false-positives
  const candidateTrianglesIndices = searchLineInIndex(lineSegment, index);

  // Find points where line segment intersects triangles
  // # of possible triangles * # of possible intersections per triangle (2) *
  // (x, y, z) coordLength
  let intersectionPoints = new Float32Array(
    candidateTrianglesIndices.length * 2 * 3
  );
  let intersectionPointsIndex = 0;

  // NOTE that intersectionPoints by default has 2x duplicates!
  // This is because every edge crossed is part of two triangles!
  // To simplify, I'll deduplicate on x. NOTE: This could be problematic for
  // vertical lines, but you can't put arrays in a Set, so it's good enough for
  // now
  const xVals = new Set();

  for (const index of candidateTrianglesIndices) {
    const triangle = triangles.subarray(index * 9, (index + 1) * 9);

    // Possibly empty array of points where line segment intersects triangle
    const intersections = lineTriangleIntersect2d(lineSegment, triangle);
    if (!intersections || intersections.length === 0) continue;

    // Otherwise, has one or more intersection point(s)
    // Fill intersectionPoints
    for (const intersection of intersections) {
      // Skip if there already exists a position with this x coordinate
      if (xVals.has(intersection[0])) continue;
      xVals.add(intersection[0]);

      // Find z coord
      const newPoint = interpolateEdge(triangle, intersection);

      // Add to array
      if (newPoint) {
        intersectionPoints.set(newPoint, intersectionPointsIndex * 3);
        intersectionPointsIndex++;
      }
    }
  }

  // Filter array to size of filled points
  intersectionPoints = intersectionPoints.subarray(
    0,
    intersectionPointsIndex * 3
  );

  // sort points in order from start to end
  // I'll convert intersectionPoints into an array of coords to simplify
  const coords: FloatArray[] = [];
  for (let i = 0; i < intersectionPoints.length / 3; i++) {
    coords.push(intersectionPoints.subarray(i * 3, (i + 1) * 3));
  }

  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  let sorted;
  if (deltaX > 0) {
    sorted = orderBy(coords, c => c[0], "asc");
  } else if (deltaX < 0) {
    sorted = orderBy(coords, c => c[0], "desc");
  } else if (deltaY > 0) {
    sorted = orderBy(coords, c => c[1], "asc");
  } else if (deltaY < 0) {
    sorted = orderBy(coords, c => c[1], "desc");
  } else {
    throw new Error("start and end point same???");
  }
  return sorted;
}
