import lineclip from "lineclip";
import Flatbush from "flatbush";
import { constructRTree } from "./rtree";
import { handlePoint, handleLineString } from "./snap";
import { FloatArray, IntegerArray, Point, PointZ, LineSegment } from "./types";

export default class SnapFeatures {
  index: Flatbush;
  triangles: FloatArray;
  bounds: [number, number, number, number];

  constructor(options) {
    const {
      indices,
      positions,
      bounds = [-Infinity, -Infinity, Infinity, Infinity]
    }: {
      indices: Int32Array;
      positions: FloatArray;
      bounds: [number, number, number, number];
    } = options;

    const { index, triangles } = constructRTree(indices, positions);
    this.index = index;
    this.triangles = triangles;

    // Intersection of provided bounds and rtree bounds
    this.bounds = [
      Math.max(bounds[0], index.minX),
      Math.max(bounds[1], index.minY),
      Math.min(bounds[2], index.maxX),
      Math.min(bounds[3], index.maxY)
    ];
  }

  // Snap arbitrary GeoJSON features
  snapFeatures = options => {
    const { features }: { features: any[] } = options;
    const newFeatures: any[] = [];

    for (const feature of features) {
      const geometryType = feature.geometry.type;

      if (geometryType === "Point") {
        const coord = feature.geometry.coordinates;
        const newCoord = this._handlePoint(coord);

        if (!newCoord) continue;

        feature.geometry.coordinates = newCoord;
        newFeatures.push(feature);
      } else if (geometryType === "MultiPoint") {
        const newCoords: PointZ[] = [];
        for (const point of feature.geometry.coordinates) {
          const newPoint = this._handlePoint(point);
          if (newPoint) newCoords.push(newPoint);
        }

        feature.geometry.coordinates = newCoords;
        newFeatures.push(feature);
      } else if (geometryType === "LineString") {
        // An array of one or more LineStrings
        const newLines = this._handleLine(feature.geometry.coordinates);
        if (!newLines) continue;

        // Single LineString
        if (newLines.length === 1) {
          feature.geometry.coordinates = newLines[0];
        } else {
          feature.geometry.type = "MultiLineString";
          feature.geometry.coordinates = newLines;
        }
        newFeatures.push(feature);
      } else if (geometryType === "MultiLineString") {
        const newCoords: PointZ[][] = [];

        for (const line of feature.geometry.coordinates) {
          const newLines = this._handleLine(line);
          if (!newLines) continue;

          // Single LineString
          if (newLines.length === 1) {
            newCoords.push(newLines[0]);
          } else {
            newCoords.push.apply(newLines);
          }
        }

        feature.geometry.coordinates = newCoords;
        newFeatures.push(feature);
      }
    }

    return newFeatures;
  };

  _handlePoint = (coord: Point) => {
    if (this.bounds && this.bounds.length === 4) {
      // Make sure coordinate is within bounds
      if (
        coord[0] < this.bounds[0] ||
        coord[0] > this.bounds[2] ||
        coord[1] < this.bounds[1] ||
        coord[1] > this.bounds[3]
      ) {
        return;
      }
    }

    return handlePoint(coord, this.index, this.triangles);
  };

  _handleLine = (coords: Point[]) => {
    // Clip line to box
    let clippedLine: Point[][] = [coords];
    if (this.bounds && this.bounds.length === 4) {
      clippedLine = lineclip(coords, this.bounds);
      if (clippedLine.length === 0) return;
    }

    const newLineSegments: Point[][] = [];
    for (const lineSegment of clippedLine) {
      newLineSegments.push(
        handleLineString(lineSegment, this.index, this.triangles)
      );
    }

    return newLineSegments;
  };

  // Snap typedArray of points
  snapPoints = options => {
    const {
      positions,
      coordLength = 2,
      featureIds
    }: {
      positions: FloatArray;
      coordLength: number;
      featureIds?: IntegerArray;
    } = options;
    const newPoints = new Float32Array((positions.length / coordLength) * 3);
    const newFeatureIds = new Uint32Array(
      (featureIds && featureIds.length) || 0
    );
    let pointIndex = 0;

    // Iterate over vertex index
    for (let i = 0; i < positions.length / coordLength; i++) {
      const coord = positions.subarray(i * coordLength, (i + 1) * coordLength);
      const newPoint = this._handlePoint(coord);

      if (newPoint) {
        newPoints.set(newPoint, pointIndex * 3);
        if (featureIds) {
          newFeatureIds[pointIndex] = featureIds[i];
        }
        pointIndex++;
      }
    }

    // Filter array to size of filled points
    return {
      positions: newPoints.subarray(0, pointIndex * 3),
      featureIds: featureIds
    };
  };

  // Snap typedArray of lines
  snapLines = options => {
    const {
      positions,
      pathIndices,
      coordLength = 2,
      featureIds
    }: {
      positions: FloatArray;
      pathIndices?: Int32Array;
      coordLength: number;
      featureIds?: Uint16Array;
    } = options;

    const newLines: LineSegment[] = [];
    const newFeatureIds: number[] = [];

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

      const newLineSegments = this._handleLine(line);
      if (!newLineSegments) continue;

      const objectId = featureIds && featureIds[i];
      for (const newLineSegment of newLineSegments) {
        newLines.push(newLineSegment);

        if (objectId) newFeatureIds.push(objectId);
      }
    }

    // Create binary arrays
    const newPositions: number[] = [];
    const newPathIndices: number[] = [];
    const newNewFeatureIds: number[] = [];

    let positionIndex = 0;
    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i];
      newPositions.push.apply(line);
      newPathIndices.push(positionIndex);

      if (featureIds) {
        for (let j = 0; j < line.length; j++) {
          newNewFeatureIds.push(newFeatureIds[i]);
        }
      }

      positionIndex += line.length;
    }

    // Backfill last index
    newPathIndices.push(newPositions.length);

    return {
      positions: Float32Array.from(newPositions),
      pathIndices: Uint32Array.from(newPathIndices),
      featureIds: Uint32Array.from(newNewFeatureIds)
    };
  };
}
