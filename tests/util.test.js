import { filterArray } from "../src/util";

const TEST_CASES = [
  // 1D coordinates
  {
    array: Float32Array.from([1, 2, 0, 3, 4, 0, 5, 6]),
    skipIndices: [2, 5],
    coordLength: 1,
    expected: Float32Array.from([1, 2, 3, 4, 5, 6])
  },
  // 1D from beginning
  {
    array: Float32Array.from([0, 2, 0, 3, 4, 0, 5, 6]),
    skipIndices: [0, 2, 5],
    coordLength: 1,
    expected: Float32Array.from([2, 3, 4, 5, 6])
  },
  // 1D removing last coordinate
  {
    array: Float32Array.from([0, 2, 0, 3, 4, 0, 5, 0]),
    skipIndices: [0, 2, 5, 7],
    coordLength: 1,
    expected: Float32Array.from([2, 3, 4, 5])
  },
  // 2D coordinates
  {
    array: Float32Array.from([1, 2, 0, 0, 3, 4, 0, 0, 5, 6]),
    skipIndices: [1, 3],
    coordLength: 2,
    expected: Float32Array.from([1, 2, 3, 4, 5, 6])
  },
  // 3D coordinates
  {
    array: Float32Array.from([1, 2, 3, 0, 0, 0, 3, 4, 5, 0, 0, 0, 5, 6, 7]),
    skipIndices: [1, 3],
    coordLength: 3,
    expected: Float32Array.from([1, 2, 3, 3, 4, 5, 5, 6, 7])
  },
  // 3D coordinates: remove everything
  {
    array: Float32Array.from([1, 2, 3, 0, 0, 0, 3, 4, 5, 0, 0, 0, 5, 6, 7]),
    skipIndices: [0, 1, 2, 3, 4],
    coordLength: 3,
    expected: Float32Array.from([])
  }
];

describe("filterArray", () => {
  test("filterArray correctly", () => {
    for (const test_case of TEST_CASES) {
      const { array, skipIndices, coordLength, expected } = test_case;
      const result = filterArray(array, skipIndices, coordLength);
      expect(result).toStrictEqual(expected);
    }
  });
});
