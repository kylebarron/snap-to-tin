import Flatbush from "flatbush";
import { splitLine2d, triangleToBounds } from "./geom";
import { LineSegment } from "./types";

// Get triangles from terrain
export function constructRTree(indices: Int32Array, positions: Float32Array) {
  // Create list of objects for insertion into RTree
  const triangles = createTriangles(indices, positions);

  // initialize Flatbush for # of items
  // each triangle has 3 vertices of 3 coordinates each
  // 16 is default for nodeSize
  // store coordinates in flatbush internally as Float32Array
  const index = new Flatbush(triangles.length / 9, 16, Float32Array);

  // fill it with bounding boxes of triangles
  for (let i = 0; i < triangles.length / 9; i++) {
    const triangle = triangles.subarray(i * 9, (i + 1) * 9);
    const [minX, minY, maxX, maxY] = triangleToBounds(triangle);
    index.add(minX, minY, maxX, maxY);
  }

  // perform the indexing
  index.finish();
  return {index, triangles};
}

export function createTriangles(
  indices: Int32Array,
  positions: Float32Array
): Float32Array {
  const triangles = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 3) {
    // The indices within `positions` of the three vertices of the triangle
    const aIndex = indices[i];
    const bIndex = indices[i + 1];
    const cIndex = indices[i + 2];

    // The three vertices of the triangle, where each vertex is an array of [x, y, z]
    const a = positions.subarray(aIndex * 3, (aIndex + 1) * 3);
    const b = positions.subarray(bIndex * 3, (bIndex + 1) * 3);
    const c = positions.subarray(cIndex * 3, (cIndex + 1) * 3);

    triangles.set(a, i * 3);
    triangles.set(b, (i + 1) * 3);
    triangles.set(c, (i + 2) * 3);
  }
  return triangles;
}

export function searchLineInIndex(options): number[] {
  const {
    index,
    line,
    maxPctArea = 0.01
  }: { index: Flatbush; line: LineSegment; maxPctArea?: number } = options;

  // Reduce total area searched in rtree to reduce false positives
  const indexArea = getIndexArea({ index });
  const nSegments = getNumLineSegments({ line, indexArea, maxPctArea });
  const lineSegments = splitLine2d({ line, nSegments });

  const resultIndices: Set<number> = new Set();
  for (const lineSegment of lineSegments) {
    const [minX, minY] = lineSegment[0];
    const [maxX, maxY] = lineSegment[1];
    index
      .search(minX, minY, maxX, maxY)
      .forEach(item => resultIndices.add(item));
  }

  return Array.from(resultIndices);
}

export function getIndexArea({ index }: { index: Flatbush }): number | null {
  let area = null;
  if (
    index.minX !== Infinity &&
    index.minY !== Infinity &&
    index.maxX !== -Infinity &&
    index.maxY !== -Infinity
  ) {
    area = (index.maxX - index.minX) * (index.maxY - index.minY);
  }
  return area;
}

export function getNumLineSegments(options): number {
  const {
    line,
    indexArea,
    maxPctArea = 0.01
  }: { line: LineSegment; indexArea: number; maxPctArea?: number } = options;
  if (!indexArea) {
    return 1;
  }

  const [minX, minY] = line[0];
  const [maxX, maxY] = line[1];
  const searchArea = (maxX - minX) * (maxY - minY);
  const pctSearch = searchArea / indexArea;
  return Math.max(1, Math.ceil(pctSearch / maxPctArea));
}
