import { polygon as Polygon } from "@turf/helpers";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";

// Get triangles from terrain
export function constructRTree(indices, positions) {
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
    triangles.push(geom);
  }

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

  // Compute area of index bounds
  index.area = null;
  if (
    index.minX !== Infinity &&
    index.minY !== Infinity &&
    index.maxX !== -Infinity &&
    index.maxY !== -Infinity
  ) {
    index.area = (index.maxX - index.minX) * (index.maxY - index.minY);
  }
  return [index, triangles];
}

// Reduce total area searched in rtree to reduce false positives
export function searchLineInIndex(options = {}) {
  const { index, minX, minY, maxX, maxY, maxPctArea = 0.01 } = options;

  // Amount of area I'm searching
  const searchArea = (maxX - minX) * (maxY - minY);

  // Number of segments to split up search into
  let nSegments = 1;
  if (index.area !== null) {
    const pctSearch = searchArea / index.area;
    nSegments = Math.ceil(pctSearch / maxPctArea);
  }

  const resultIndices = new Set();
  for (let i = 0; i < nSegments; i++) {
    // _i_th part of the way from min to max
    const thisMinX = minX + (i / nSegments) * (maxX - minX);
    const thisMaxX = minX + ((i + 1) / nSegments) * (maxX - minX);
    const thisMinY = minY + (i / nSegments) * (maxY - minY);
    const thisMaxY = minY + ((i + 1) / nSegments) * (maxY - minY);
    index
      .search(thisMinX, thisMinY, thisMaxX, thisMaxY)
      .forEach(item => resultIndices.add(item));
  }

  return Array.from(resultIndices);
}
