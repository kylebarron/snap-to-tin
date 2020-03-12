import { polygon as Polygon } from "@turf/helpers";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { splitLine } from "./geom";
import { LineSegment } from "./types";

// Get triangles from terrain
export function constructRTree(indices, positions) {
  // Create list of objects for insertion into RTree
  const triangles = createTriangles(indices, positions);

  // initialize Flatbush for # of items
  const index = new Flatbush(triangles.length);

  // fill it with bounding boxes of triangles
  for (const triangle of triangles) {
    // Get bounding box of triangle for insertion into rtree
    const [minX, minY, maxX, maxY] = bbox(triangle);
    index.add(minX, minY, maxX, maxY);
  }

  // perform the indexing
  index.finish();
  return [index, triangles];
}

function createTriangles(indices, positions) {
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
    triangles.push(geom);
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
  const lineSegments = splitLine({ line, nSegments });

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
  return Math.ceil(pctSearch / maxPctArea);
}
