import {
  polygon as Polygon,
  lineString as LineString,
  point as Point,
  feature as Feature
} from "@turf/helpers";
import { getType } from "@turf/invariant";
import bbox from "@turf/bbox";
import bboxClip from "@turf/bbox-clip";
import pointInPolygon from "@turf/boolean-point-in-polygon";
import barycentric from "barycentric";
import lineIntersect from "@turf/line-intersect";
import _ from "lodash";
import equals from "fast-deep-equal/es6"
import Flatbush from 'flatbush';


export function snapFeatures(options = {}) {
  const { terrain, features, bounds = [0, 0, 1, 1] } = options;

  const [index, triangles] = constructRTree(terrain);
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

      clippedFeature.geometry.coordinates = handleLineString(coords, index, triangles)
      newFeatures.push(clippedFeature);
    } else {
      console.error("invalid type");
    }
  }

  return newFeatures;
}

// Get triangles from terrain
function constructRTree(terrain) {
  // triples of position indices that make up the faces of the terrain
  const indices = terrain.indices.value;
  // x, y, z positions in space of each index
  const positions = terrain.attributes.POSITION.value;

  // Create list of objects for insertion into RTree
  const triangles = [];

  for (let i = 0; i < indices.length; i += 3) {
    // The indices within `positions` of the three vertices of the triangle
    const aIndex = indices[i];
    const bIndex = indices[i + 1];
    const cIndex = indices[i + 2];

    // The three vertices of the triangle, where each vertex is an array of [x, y, z]
    const a = positions.subarray(aIndex * 3, (aIndex + 1) * 3);
    const b = positions.subarray(bIndex * 3, (bIndex + 1) * 3);
    const c = positions.subarray(cIndex * 3, (cIndex + 1) * 3);

    // Create polygon from these coords
    const geom = Polygon([[a, b, c, a]]);
    triangles.push(geom)
  }

  // initialize Flatbush for # of items
  const index = new Flatbush(triangles.length);

  // fill it with 1000 rectangles
  for (const triangle of triangles) {
    // Get bounding box of triangle for insertion into rtree
    const [minX, minY, maxX, maxY] = bbox(triangle);
    index.add(minX, minY, maxX, maxY);
  }

  // perform the indexing
  index.finish();
  return [index, triangles];
}

// Find elevation of point
function handlePoint(point, index, triangles) {
  // Search index for point
  const [x, y] = point.slice(0, 2);
  const results = index.search(x, y, x, y).map((i) => triangles[i]);

  // Check each result
  // Since I'm working with triangles and not square boxes, it's possible that a point could be
  // inside the triangle's bounding box but outside the triangle itself.
  const filteredResults = results.filter(result => {
    if (pointInPolygon(point, result)) return result;
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
  const interpolatedPoint = interpolateTriangle(
    triangle[0],
    triangle[1],
    triangle[2],
    point
  );
  return interpolatedPoint;
}

// a, b, c must be arrays of three elements
// point must be an array of two elements
// TODO: add tests where you assert that the interpolated z is above the min vertex height and below
// the max vertex height
function interpolateTriangle(a, b, c, point) {
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

// Add coordinates for LineString
function handleLineString(line, index, triangles) {
  let coordsWithZ = [];

  // Loop over each line segment
  for (let i = 0; i < line.length - 1; i++) {
    const start = line[i];
    const end = line[i + 1];
    const lineSegment = LineString([start, end]);

    // Sometimes the start and end points can be the same, usually from clipping
    if (equals(start, end)) {
      continue;
    }

    // Find edges that this line segment crosses
    // First search in rtree. This is fast but has false-positives
    const minX = Math.min(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const maxX = Math.max(start[0], end[0]);
    const maxY = Math.max(start[1], end[1]);
    const results = index.search(minX, minY, maxX, maxY).map((i) => triangles[i]);

    // Find points where line crosses edges
    // intersectionPoints is [Feature[Point]]
    // Note that intersectionPoints has 2x duplicates!
    // This is because every edge crossed is part of two triangles!
    const intersectionPoints = results.flatMap(result => {
      const intersection = lineIntersect(lineSegment, result.geometry);
      if (intersection.features.length === 0) return [];

      // Otherwise, has an intersection point(s)
      const newPoints = [];
      const triangle = result.geometry.coordinates[0];
      for (const int of intersection.features) {
        const point = int.geometry.coordinates;
        const newPoint = interpolateTriangle(
          triangle[0],
          triangle[1],
          triangle[2],
          point
        );
        newPoints.push(newPoint);
      }

      return newPoints;
    });

    // Quick and dirty deduplication
    // Since interpolateTriangle appears to be working now, this just deduplicates on the first
    // element.
    // TODO: make more performant; Remove lodash dependency
    const uniqCoords = _.uniqBy(intersectionPoints, x => x[0]);

    // sort points in order from start to end
    const deltaX = end[0] - start[0];
    const deltaY = end[1] - start[1];
    let sorted;
    if (deltaX > 0) {
      sorted = _.orderBy(uniqCoords, c => c[0], "asc");
    } else if (deltaX < 0) {
      sorted = _.orderBy(uniqCoords, c => c[0], "desc");
    } else if (deltaY > 0) {
      sorted = _.orderBy(uniqCoords, c => c[1], "asc");
    } else if (deltaY < 0) {
      sorted = _.orderBy(uniqCoords, c => c[1], "desc");
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
