import { getType } from "@turf/invariant";
import bboxClip from "@turf/bbox-clip";
import { constructRTree } from "./rtree";
import { handlePoint, handleLineString } from "./snap";

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

      const newPoint = handlePoint(coord, index, triangles);
      if (!newPoint) continue;
      feature.geometry.coordinates = newPoint;
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
