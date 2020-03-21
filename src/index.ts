import { getType } from "@turf/invariant";
import bboxClip from "@turf/bbox-clip";
import lineclip from "lineclip";
import Flatbush from "flatbush";
import { constructRTree } from "./rtree";
import { handlePoint, handleLineString } from "./snap";
import { filterArray } from "./util";
import { FloatArray, IntegerArray, TypedArray, Point } from "./types";

interface snapPointsResultType {
  positions: TypedArray;
  objectIds?: TypedArray;
}

interface snapLinesResultType {
  positions: TypedArray;
  objectIds: TypedArray;
  pathIndices: TypedArray;
}

export class SnapFeatures {
  index: Flatbush;
  triangles: FloatArray;
  bounds: [number, number, number, number] | null;

  constructor(options) {
    const {
      indices,
      positions,
      bounds = null
    }: {
      indices: Int32Array;
      positions: FloatArray;
      bounds: [number, number, number, number] | null;
    } = options;

    const { index, triangles } = constructRTree(indices, positions);
    this.index = index;
    this.triangles = triangles;
    this.bounds = bounds;
  }

  // Snap arbitrary GeoJSON features
  snapFeatures = (features: any[]) => {
    const newFeatures: any[] = [];

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
      coordLength = 2,
      objectIds
    }: {
      positions: FloatArray;
      coordLength: number;
      objectIds?: IntegerArray;
    } = options;
    const newPoints = new Float32Array((positions.length / coordLength) * 3);
    const skipIndices: number[] = [];

    // Iterate over vertex index
    for (let i = 0; i < positions.length / coordLength; i++) {
      const coord = positions.subarray(i * coordLength, (i + 1) * coordLength);

      if (this.bounds && this.bounds.length === 4) {
        // If outside bounds, skip
        if (
          coord[0] < this.bounds[0] ||
          coord[0] > this.bounds[2] ||
          coord[1] < this.bounds[1] ||
          coord[1] > this.bounds[3]
        ) {
          skipIndices.push(i);
          continue;
        }
      }

      const newPoint = handlePoint(coord, this.index, this.triangles);
      if (!newPoint) {
        console.log("point not found");
        skipIndices.push(i);
        continue;
      }

      // Fill point into array
      newPoints.set(newPoint, i * coordLength);
    }

    // Remove points that were allocated but not filled
    const results: snapPointsResultType = {
      positions: filterArray(newPoints, skipIndices, 3)
    };
    if (objectIds && objectIds.length > 0) {
      results.objectIds = filterArray(objectIds, skipIndices, 1);
    }
    return results;
  };

  // Snap typedArray of lines
  snapLines = options => {
    const {
      positions,
      pathIndices,
      coordLength = 2,
      objectIds
    }: {
      positions: FloatArray;
      pathIndices?: Int32Array;
      coordLength: number;
      objectIds?: Uint16Array;
    } = options;

    let data: snapLinesResultType = {
      positions: new Float32Array((positions.length / coordLength) * 3),
      pathIndices: new Int32Array((pathIndices && pathIndices.length) || 2),
      objectIds: objectIds
        ? new Int32Array((positions.length / coordLength) * 3)
        : new Int32Array(0)
    };

    let index = {
      positions: 0,
      pathIndices: 0
    };

    // Loop over each LineString, as defined by pathIndices
    const loopIndices = pathIndices ? pathIndices : [0, positions.length];
    for (let i = 0; i < loopIndices.length - 1; i++) {
      const positionStartIndex = loopIndices[i];
      const positionEndIndex = loopIndices[i + 1];

      // Make array of coordinates
      const line: FloatArray[] = [];
      for (let j = positionStartIndex; j < positionEndIndex; j++) {
        line.push(positions.subarray(j * coordLength, (j + 1) * coordLength));
      }

      // Clip line to box
      const clippedLine: Point[] = lineclip(line, this.bounds);

      // If empty, continue
      if (clippedLine.length === 0) {
        continue;
      }

      const newCoords = handleLineString(
        clippedLine,
        this.index,
        this.triangles
      );
      const nNewCoords = newCoords.length / 3;

      // Fill positions
      data.positions.set(newCoords, index.positions * coordLength);

      // Fill objectIds
      if (objectIds) {
        // objectId should be the same for all vertices within a single
        // LineString
        const objectId = objectIds[index.positions];
        data.objectIds.set(new Int16Array(nNewCoords).fill(objectId));
      }

      // Fill pathIndices
      data.pathIndices[index.pathIndices] = index.positions;

      // Increment
      index.positions += nNewCoords;
      index.pathIndices++;
    }

    // Resize arrays given total position count
    data.positions = data.positions.subarray(0, index.positions * 3);
    data.objectIds = data.objectIds.subarray(0, index.positions);
    data.pathIndices = data.pathIndices.subarray(0, index.pathIndices);
    return data;
  };
}
