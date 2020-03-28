import lineclip from "lineclip";
import Flatbush from "flatbush";
import { constructRTree } from "./rtree";
import { handlePoint, handleLineString } from "./snap";
import {
  FloatArray,
  IntegerArray,
  TypedArray,
  Point,
  PointZ,
  LineSegment
} from "./types";

interface snapLinesResultType {
  positions: TypedArray;
  objectIds: TypedArray;
  pathIndices: TypedArray;
}

export default class SnapFeatures {
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
      objectIds
    }: {
      positions: FloatArray;
      coordLength: number;
      objectIds?: IntegerArray;
    } = options;
    const newPoints = new Float32Array((positions.length / coordLength) * 3);
    const newObjectIds = new Uint32Array((objectIds && objectIds.length) || 0);
    let pointIndex = 0;

    // Iterate over vertex index
    for (let i = 0; i < positions.length / coordLength; i++) {
      const coord = positions.subarray(i * coordLength, (i + 1) * coordLength);
      const newPoint = this._handlePoint(coord);

      if (newPoint) {
        newPoints.set(newPoint, pointIndex * 3);
        if (objectIds) {
          newObjectIds[pointIndex] = objectIds[i];
        }
        pointIndex++;
      }
    }

    // Filter array to size of filled points
    return {
      positions: newPoints.subarray(0, pointIndex * 3),
      objectIds: objectIds
    };
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
