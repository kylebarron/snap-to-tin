import {
  polygon as Polygon,
  lineString as LineString,
  point as Point,
  feature as Feature
} from "@turf/helpers";
import { getType } from "@turf/invariant";
import bbox from "@turf/bbox";
import bboxClip from "@turf/bbox-clip";
import RBush from "rbush";
import pointInPolygon from "@turf/boolean-point-in-polygon";
import barycentric from "barycentric";
import lineIntersect from "@turf/line-intersect";
import _ from "lodash";


export function snapFeatures(options = {}) {
  const { terrain, features, bounds = [0, 0, 1, 1] } = options;

  const tree = constructRTree(terrain);
  const newFeatures = [];

  for (const feature of features) {
    if (getType(feature) === "Point") {
      const coord = feature.geometry.coordinates;

      // Make sure coordinate is within bounds
      if (
        coord[0] < bounds[0] ||
        coord[0] > bounds[2] ||
        coord[1] < bounds[1] ||
        coord[1] > bounds[3]
      ) {
        continue;
      }

      feature.geometry.coordinates = handlePoint(coord, tree);
      newFeatures.push(feature);
    } else if (getType(feature) === "LineString") {
      // Clip to box
      var clippedFeature = bboxClip(feature, bounds);
      var coords = clippedFeature.geometry.coordinates;
      if (coords.length === 0) {
        continue;
      }

      // Note that the clipped Feature can now be a MultiLineString
      if (getType(clippedFeature) === "MultiLineString") {
        continue;
      }

      var line = handleLineString(coords, tree);
      line.properties = clippedFeature.properties;
      newFeatures.push(line);

      // var newFeature = Feature(line, clippedFeature.properties);
      // newFeatures.push(newFeature);
    } else {
      console.error("invalid type");
    }
  }

  return newFeatures;
}

// Get triangles from terrain
function constructRTree(terrain) {
  // triples of position indices that make up the faces of the terrain
  var indices = terrain.indices.value;
  // x, y, z positions in space of each index
  var positions = terrain.attributes.POSITION.value;

  // Create list of objects for insertion into RTree
  var rtreeTriangles = [];

  for (let i = 0; i < indices.length; i += 3) {
    // The indices within `positions` of the three vertices of the triangle
    var aIndex = indices[i];
    var bIndex = indices[i + 1];
    var cIndex = indices[i + 2];

    // The three vertices of the triangle, where each vertex is an array of [x, y, z]
    var a = positions.subarray(aIndex * 3, (aIndex + 1) * 3);
    var b = positions.subarray(bIndex * 3, (bIndex + 1) * 3);
    var c = positions.subarray(cIndex * 3, (cIndex + 1) * 3);

    // Create polygon from these coords
    var geom = Polygon([[a, b, c, a]]);

    // Get bounding box of triangle for insertion into rtree
    var [minX, minY, maxX, maxY] = bbox(geom);

    // Make object that will be inserted into RTree
    var rtreeTriangle = {
      minX,
      minY,
      maxX,
      maxY,
      feature: geom
    };
    rtreeTriangles.push(rtreeTriangle);
  }

  var tree = new RBush();
  tree.load(rtreeTriangles);
  return tree;
}

// Find elevation of point
function handlePoint(point, tree) {

  const searchPoint = {
    minX: point[0],
    minY: point[1],
    maxX: point[0],
    maxY: point[1]
  };
  const results = tree.search(searchPoint);

  // Check each result
  // Since I'm working with triangles and not square boxes, it's possible that a point could be
  // inside the triangle's bounding box but outside the triangle itself.
  const filteredResults = results.filter(result => {
    if (pointInPolygon(point, result.feature)) return result;
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
  const triangle = filteredResults[0].feature.geometry.coordinates[0];
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
function handleLineString(line, tree) {
  let coordsWithZ = [];

  // Loop over each line segment
  for (let i = 0; i < line.length - 1; i++) {
    var start = line[i];
    var end = line[i + 1];
    var lineSegment = LineString([start, end]);
    if (_.isEqual(start, end)) {
      continue;
    }

    // Find edges that this line segment crosses
    // First search in rtree. This is fast but has false-positives
    var searchBbox = {
      minX: Math.min(start[0], end[0]),
      minY: Math.min(start[1], end[1]),
      maxX: Math.max(start[0], end[0]),
      maxY: Math.max(start[1], end[1])
    };
    var results = tree.search(searchBbox);

    // Find points where line crosses edges
    // intersectionPoints is [Feature[Point]]
    // Note that intersectionPoints has 2x duplicates!
    // This is because every edge crossed is part of two triangles!
    var intersectionPoints = results.flatMap(result => {
      const intersection = lineIntersect(lineSegment, result.feature.geometry);
      if (intersection.features.length === 0) return [];

      // Otherwise, has an intersection point(s)
      const newPoints = [];
      const triangle = result.feature.geometry.coordinates[0];
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
    var uniqCoords = _.uniqBy(intersectionPoints, x => x[0]);

    // sort points in order from start to end
    var deltaX = end[0] - start[0];
    var deltaY = end[1] - start[1];
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

    var newStart = handlePoint(start, tree);
    coordsWithZ.push(newStart);
    coordsWithZ = coordsWithZ.concat(sorted);
  }

  var endPoint = line.slice(-1)[0];
  coordsWithZ.push(handlePoint(endPoint, tree));
  return LineString(coordsWithZ);
}
