import { getType } from "@turf/invariant";
import bboxClip from "@turf/bbox-clip";
import isPointInPolygon from "@turf/boolean-point-in-polygon";
import uniqBy from "lodash.uniqby";
import orderBy from "lodash.orderby";
import equals from "fast-deep-equal";
import {
  interpolateTriangle,
  interpolateEdge,
  lineTriangleIntersect
} from "./geom";
import { constructRTree, searchLineInIndex } from "./rtree";

export function snapFeatures(options = {}) {
  const { indices, positions, features, bounds = null } = options;

  const [index, triangles] = constructRTree(indices, positions);
  const newFeatures = [];

  for (const feature of features) {
    const geometryType = getType(feature);

    if (geometryType === "Point") {
      const coord = feature.geometry.coordinates;

      if (bounds && bounds.length === 4) {
        // Make sure coordinate is within bounds
        if (
          coord[0] < bounds[0] ||
          coord[0] > bounds[2] ||
          coord[1] < bounds[1] ||
          coord[1] > bounds[3]
        ) {
          continue;
        }
      }

      feature.geometry.coordinates = handlePoint(coord, index, triangles);
      newFeatures.push(feature);
    } else if (geometryType === "LineString") {
      // Instantiate clippedFeature in case bounds is null
      let clippedFeature = feature;

      // Clip to box
      if (bounds && bounds.length === 4) {
        clippedFeature = bboxClip(feature, bounds);
      }

      const coords = clippedFeature.geometry.coordinates;

      // If empty, continue
      if (coords.length === 0) {
        continue;
      }

      // TODO: support multilinestrings
      // Note that the clipped Feature can now be a MultiLineString
      if (getType(clippedFeature) === "MultiLineString") {
        continue;
      }

      clippedFeature.geometry.coordinates = handleLineString(
        coords,
        index,
        triangles
      );
      newFeatures.push(clippedFeature);
    } else {
      console.error("invalid type");
    }
  }

  return newFeatures;
}

// Find elevation of point
function handlePoint(point, index, triangles) {
  // Search index for point
  const [x, y] = point.slice(0, 2);
  const results = index.search(x, y, x, y).map(i => triangles[i]);

  // Check each result
  // Since I'm working with triangles and not square boxes, it's possible that a point could be
  // inside the triangle's bounding box but outside the triangle itself.
  const filteredResults = results.filter(result => {
    if (isPointInPolygon(point, result)) return result;
  });

  // if (filteredResults.length > 1) {
  //   console.log(`${filteredResults.length} results from point in polygon search`)
  // }
  //
  // if (filteredResults.length === 0) {
  //   console.log('no results')
  //   console.log(point)
  // }

  // Now linearly interpolate elevation within this triangle
  const triangle = filteredResults[0].geometry.coordinates[0];
  const interpolatedPoint = interpolateTriangle(triangle, point);
  return interpolatedPoint;
}

// Add coordinates for LineString
function handleLineString(line, index, triangles) {
  let coordsWithZ = [];

  // Loop over each line segment
  for (let i = 0; i < line.length - 1; i++) {
    const start = line[i];
    const end = line[i + 1];
    const lineSegment = [start, end];

    // Sometimes the start and end points can be the same, usually from clipping
    if (equals(start, end)) {
      continue;
    }

    // Find edges that this line segment crosses
    // First search in rtree. This is fast but has false-positives
    const results = searchLineInIndex({ line: lineSegment, index }).map(
      i => triangles[i]
    );

    // Find points where line crosses edges
    // intersectionPoints is Array([x, y, z])
    // Note that intersectionPoints has 2x duplicates!
    // This is because every edge crossed is part of two triangles!
    const intersectionPoints = results.flatMap(result => {
      const triangle = result.geometry.coordinates[0];

      // Rename:
      const intersectionPoints = lineTriangleIntersect(lineSegment, triangle);
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

    const newStart = handlePoint(start, index, triangles);
    coordsWithZ.push(newStart);
    coordsWithZ = coordsWithZ.concat(sorted);
  }

  const endPoint = line.slice(-1)[0];
  coordsWithZ.push(handlePoint(endPoint, index, triangles));
  return coordsWithZ;
}
