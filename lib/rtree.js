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

  // fill it with 1000 rectangles
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
