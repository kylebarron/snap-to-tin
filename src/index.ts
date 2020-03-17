import { getType } from "@turf/invariant";
import bboxClip from "@turf/bbox-clip";
import Flatbush from "flatbush";
import { constructRTree } from "./rtree";
import { handlePoint, handleLineString } from "./snap";

export class snapFeatures {
  index: Flatbush;
  triangles: Float32Array;
  bounds: [number, number, number, number] | null;

  constructor(options) {
    const {
      indices,
      positions,
      bounds = null
    }: {
      indices: Int32Array;
      positions: Float32Array;
      bounds: [number, number, number, number] | null;
    } = options;

    const { index, triangles } = constructRTree(indices, positions);
    this.index = index;
    this.triangles = triangles;
    this.bounds = bounds;
  }

  // Snap arbitrary GeoJSON features
  snapFeatures = (features: any[]) => {
    const newFeatures = [];

    for (const feature of features) {
      const geometryType = getType(feature);

      if (geometryType === "Point") {
        const coord = feature.geometry.coordinates;

        if (this.bounds && this.bounds.length === 4) {
          // Make sure coordinate is within bounds
          if (
            coord[0] < this.bounds[0] ||
            coord[0] > this.bounds[2] ||
            coord[1] < this.bounds[1] ||
            coord[1] > this.bounds[3]
          ) {
            continue;
          }
        }

        const newPoint = handlePoint(coord, this.index, this.triangles);
        if (!newPoint) continue;
        feature.geometry.coordinates = newPoint;
        newFeatures.push(feature);
      } else if (geometryType === "LineString") {
        // Instantiate clippedFeature in case bounds is null
        let clippedFeature = feature;

        // Clip to box
        if (this.bounds && this.bounds.length === 4) {
          clippedFeature = bboxClip(feature, this.bounds);
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
          this.index,
          this.triangles
        );
        newFeatures.push(clippedFeature);
      }
    }

    return newFeatures;
  };

  // Snap typedArray of points
  snapPoints = options => {
    const {
      positions,
      coordLength = 2
    }: { positions: Float32Array; coordLength: number } = options;
    const newPoints = new Float32Array((positions.length / coordLength) * 3);

    for (let i = 0; i < positions.length; i += coordLength) {
      const coord = positions.subarray(i * coordLength, (i + 1) * coordLength);

      if (this.bounds && this.bounds.length === 4) {
        // Make sure coordinate is within bounds
        if (
          coord[0] < this.bounds[0] ||
          coord[0] > this.bounds[2] ||
          coord[1] < this.bounds[1] ||
          coord[1] > this.bounds[3]
        ) {
          continue;
        }
      }

      const newPoint = handlePoint(coord, this.index, this.triangles);
      if (!newPoint) {
        console.log("point not found");
        continue;
      }

      newPoints.set(newPoint, i * coordLength);
    }
  };

  // Snap typedArray of lines
  snapLines = () => {};
}
