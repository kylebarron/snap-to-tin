import {
  pointOnLine,
  distanceLine,
  floatIsClose,
  lineLineIntersection,
  lineTriangleIntersect
} from "../lib/geom";

describe("pointOnLine", () => {
  test("between", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [0.5, 0.5];
    expect(pointOnLine(a, b, point)).toBe(true);
  });

  test("before", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [-0.5, -0.5];
    expect(pointOnLine(a, b, point)).toBe(false);
  });

  test("after", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [1.5, 1.5];
    expect(pointOnLine(a, b, point)).toBe(false);
  });

  test("on beginning endpoint", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [0, 0];
    expect(pointOnLine(a, b, point)).toBe(true);
  });

  test("on ending endpoint", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [1, 1];
    expect(pointOnLine(a, b, point)).toBe(true);
  });

  test("slightly off", () => {
    const a = [0, 0];
    const b = [1, 1];
    const point = [0.49999999999, 0.49999999999];
    expect(pointOnLine(a, b, point)).toBe(true);
  });
});

describe("distanceLine", () => {
  test("simple calc", () => {
    const a = [0, 0];
    const b = [1, 1];
    expect(distanceLine(a, b)).toBe(Math.sqrt(2));
  });

  test("same point", () => {
    const a = [0, 0];
    const b = [0, 0];
    expect(distanceLine(a, b)).toBe(0);
  });
});

describe("floatIsClose", () => {
  test("test equal to epsilon", () => {
    const a = 0;
    const b = 0.0000000001;
    expect(floatIsClose(a, b, 1e-10)).toBe(false);
  });

  test("test less than epsilon", () => {
    const a = 0;
    const b = 0.00000000009;
    expect(floatIsClose(a, b, 1e-10)).toBe(true);
  });
});

describe("lineLineIntersection", () => {
  test("simple x", () => {
    const a = [0, 0];
    const b = [1, 1];
    const c = [0, 1];
    const d = [1, 0];
    expect(lineLineIntersection(a, b, c, d)).toStrictEqual([0.5, 0.5]);
  });

  test("simple L; intersect at start endpoint", () => {
    const a = [0, 0];
    const b = [0, 1];
    const c = [0, 0];
    const d = [1, 0];
    expect(lineLineIntersection(a, b, c, d)).toStrictEqual([0, 0]);
  });

  test("simple L; intersect at end endpoint", () => {
    const a = [0, 1];
    const b = [1, 1];
    const c = [1, 0];
    const d = [1, 1];
    expect(lineLineIntersection(a, b, c, d)).toStrictEqual([1, 1]);
  });

  test("parallel lines", () => {
    const a = [0, 0];
    const b = [0, 1];
    const c = [1, 0];
    const d = [1, 1];
    expect(lineLineIntersection(a, b, c, d)).toBe(false);
  });

  test("overlapping lines", () => {
    const a = [0, 0];
    const b = [0, 1];
    const c = [0, 0];
    const d = [0, 1];
    expect(lineLineIntersection(a, b, c, d)).toBe(false);
  });

  test("intersect outside segments", () => {
    const a = [0, 0];
    const b = [0, 1];
    const c = [2, -2];
    const d = [2, 2];
    expect(lineLineIntersection(a, b, c, d)).toBe(false);
  });
});

describe("lineTriangleIntersect", () => {
  test("intersect one edge only", () => {
    const line = [
      [0.25, 0.25],
      [1, 1]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([[0.5, 0.5]]);
  });

  test("intersect two edges, with neither at line endpoint", () => {
    const line = [
      [-1, 0.5],
      [2, 0.5]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([
      [0, 0.5],
      [0.5, 0.5]
    ]);
  });

  test("intersect two edges, with one at line endpoint", () => {
    const line = [
      [0, 0.5],
      [2, 0.5]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([
      [0, 0.5],
      [0.5, 0.5]
    ]);
  });

  test("intersect two edges, with both at line endpoints", () => {
    const line = [
      [0, 0.5],
      [0.5, 0.5]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([
      [0, 0.5],
      [0.5, 0.5]
    ]);
  });

  test("intersect at triangle vertex", () => {
    const line = [
      [-1, 1],
      [1, 1]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    // Note, currently returns duplicates
    expect(result).toStrictEqual([
      [0, 1],
      [0, 1]
    ]);
  });

  test("intersect at triangle vertex, also line endpoint", () => {
    const line = [
      [0, 1],
      [1, 1]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    // Note, currently returns duplicates
    expect(result).toStrictEqual([
      [0, 1],
      [0, 1]
    ]);
  });

  test("overlapping line and triangle edge, intersect two vertices", () => {
    const line = [
      [0, 0],
      [0, 1]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    // Counterintuitive at first, but this is desired behavior. See #23
    expect(result).toContainEqual([0, 0]);
    expect(result).toContainEqual([0, 1]);
  });

  test("overlapping line and triangle edge, intersect one vertex", () => {
    const line = [
      [0, 0],
      [0, 0.5]
    ];
    const triangle = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ];
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([[0, 0]]);
  });
});
