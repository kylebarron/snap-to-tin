import {
  constructRTree,
  createTriangles,
  getNumLineSegments
} from "../src/rtree";

describe("constructRTree", () => {
  test("constructRTree correctly", () => {
    // prettier-ignore
    const indices = Int32Array.from([
      0, 1, 2,
      2, 3, 0
    ])
    // prettier-ignore
    const positions = Float32Array.from([
      0, 0, 10,
      1, 1, 20,
      0, 4, 30,
      4, 0, 40,
    ])
    const { index } = constructRTree(indices, positions);
    expect(index.minX).toEqual(0);
    expect(index.minY).toEqual(0);
    expect(index.maxX).toEqual(4);
    expect(index.maxY).toEqual(4);
    expect(index.numItems).toEqual(2);
  });
});

describe("createTriangles", () => {
  test("create triangles correctly", () => {
    // prettier-ignore
    const indices = Int32Array.from([
      0, 1, 2,
      2, 3, 0
    ])
    // prettier-ignore
    const positions = Float32Array.from([
      0, 0, 10,
      1, 1, 20,
      0, 4, 30,
      4, 0, 40,
    ])
    const result = createTriangles(indices, positions);
    // prettier-ignore
    const expected = Float32Array.from([
      0, 0, 10,
      1, 1, 20,
      0, 4, 30,
      0, 4, 30,
      4, 0, 40,
      0, 0, 10,
    ])
    expect(result).toEqual(expected);
  });
});

describe("getNumLineSegments", () => {
  test("break into 100 segments for diagonal line", () => {
    const line = [
      [0, 0],
      [1, 1]
    ];
    const indexArea = 1;
    const maxPctArea = 0.01;
    const result = getNumLineSegments({ line, indexArea, maxPctArea });
    expect(result).toEqual(indexArea / maxPctArea);
  });

  test("keep 1 segment for horizontal line", () => {
    const line = [
      [0, 0],
      [0, 1]
    ];
    const indexArea = 1;
    const maxPctArea = 0.01;
    const result = getNumLineSegments({ line, indexArea, maxPctArea });
    expect(result).toEqual(1);
  });

  test("keep 1 segment for vertical line", () => {
    const line = [
      [0, 0],
      [1, 0]
    ];
    const indexArea = 1;
    const maxPctArea = 0.01;
    const result = getNumLineSegments({ line, indexArea, maxPctArea });
    expect(result).toEqual(1);
  });
});
