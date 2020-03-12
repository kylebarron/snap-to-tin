import { getNumLineSegments } from "../src/rtree";

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
