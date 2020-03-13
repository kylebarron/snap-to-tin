import {
  interpolateTriangle,
  interpolateEdge,
  pointOnLine,
  distanceLine,
  floatIsClose,
  lineLineIntersection,
  lineTriangleIntersect,
  triangleToEdges,
  triangleVertex,
  splitLine,
  triangleToBounds,
  pointInTriangle,
  barycentric
} from "../src/geom";

describe("interpolateTriangle", () => {
  test("interpolates correctly on edge", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0.5];
    const result = interpolateTriangle(point, triangle);
    expect(result).toStrictEqual([0, 0.5, 15]);
  });

  test("interpolates correctly at vertex", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0];
    const result = interpolateTriangle(point, triangle);
    expect(result).toStrictEqual([0, 0, 10]);
  });

  test("interpolates correctly inside triangle", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [1, Math.sqrt(3) / 2];
    const result = interpolateTriangle(point, triangle);
    expect(result).toStrictEqual([1, Math.sqrt(3) / 2, 20]);
  });

  test("returns null for point not on edge, outside triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [10, 10];
    const result = interpolateTriangle(point, triangle);
    expect(result).toBeNull();
  });
});

describe("interpolateEdge", () => {
  test("interpolates correctly on edge", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0.5];
    const result = interpolateEdge(triangle, point);
    expect(result).toStrictEqual([0, 0.5, 15]);
  });

  test("interpolates correctly at vertex", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0];
    const result = interpolateEdge(triangle, point);
    expect(result).toStrictEqual([0, 0, 10]);
  });

  test("returns null for point not on edge, outside triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [10, 10];
    const result = interpolateEdge(triangle, point);
    expect(result).toBeNull();
  });

  test("returns null for point not on edge, inside triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0.25, 0.25];
    const result = interpolateEdge(triangle, point);
    expect(result).toBeNull();
  });
});

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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([[0.5, 0.5]]);
  });

  test("intersect two edges, with neither at line endpoint", () => {
    const line = [
      [-1, 0.5],
      [2, 0.5]
    ];
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
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
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
    const result = lineTriangleIntersect(line, triangle);
    expect(result).toStrictEqual([[0, 0]]);
  });
});

describe("triangleToEdges", () => {
  test("returns edges", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 0,
      0, 1, 0,
      1, 0, 0
    ]);
    const generator = triangleToEdges(triangle);
    const firstEdge = generator.next().value;
    const secondEdge = generator.next().value;
    const thirdEdge = generator.next().value;
    const expectedFirst = [
      Float32Array.from([0, 0, 0]),
      Float32Array.from([0, 1, 0])
    ];
    const expectedSecond = [
      Float32Array.from([0, 1, 0]),
      Float32Array.from([1, 0, 0])
    ];
    const expectedThird = [
      Float32Array.from([1, 0, 0]),
      Float32Array.from([0, 0, 0])
    ];
    expect(firstEdge).toEqual(expectedFirst);
    expect(secondEdge).toEqual(expectedSecond);
    expect(thirdEdge).toEqual(expectedThird);
  });
});

describe("triangleVertex", () => {
  // prettier-ignore
  const triangle = Float32Array.from([
    0, 0, 0,
    0, 1, 0,
    1, 0, 0
  ]);
  test("returns vertex 0", () => {
    const i = 0;
    const result = triangleVertex(i, triangle);
    const expected = Float32Array.from([0, 0, 0]);
    expect(result).toEqual(expected);
  });
  test("returns vertex 1", () => {
    const i = 1;
    const result = triangleVertex(i, triangle);
    const expected = Float32Array.from([0, 1, 0]);
    expect(result).toEqual(expected);
  });
  test("returns vertex 2", () => {
    const i = 2;
    const result = triangleVertex(i, triangle);
    const expected = Float32Array.from([1, 0, 0]);
    expect(result).toEqual(expected);
  });
});

describe("splitLine", () => {
  test("returns self when split into one segment", () => {
    const line = [
      [0, 0],
      [1, 1]
    ];
    const nSegments = 1;
    const result = splitLine({ line, nSegments });
    expect(result).toContainEqual([
      [0, 0],
      [1, 1]
    ]);
  });

  test("splits into segments", () => {
    const line = [
      [0, 0],
      [1, 1]
    ];
    const nSegments = 2;
    const result = splitLine({ line, nSegments });
    expect(result).toContainEqual([
      [0, 0],
      [0.5, 0.5]
    ]);
    expect(result).toContainEqual([
      [0.5, 0.5],
      [1, 1]
    ]);
  });

  test("splits into 3 segments", () => {
    const line = [
      [0, 0],
      [1, 1]
    ];
    const nSegments = 3;
    const result = splitLine({ line, nSegments });
    expect(result).toContainEqual([
      [0, 0],
      [1 / 3, 1 / 3]
    ]);
    expect(result).toContainEqual([
      [1 / 3, 1 / 3],
      [2 / 3, 2 / 3]
    ]);
    expect(result).toContainEqual([
      [2 / 3, 2 / 3],
      [1, 1]
    ]);
  });
});

describe("triangleToBounds", () => {
  test("find bounds of triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const result = triangleToBounds(triangle);
    const expected = [0, 0, 1, 1];
    expect(result).toStrictEqual(expected);
  });
});

describe("pointInTriangle", () => {
  test("point on boundary", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0.5];
    const result = pointInTriangle(point, triangle);
    expect(result).toBe(true);
  });
  test("point at vertex", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0, 0];
    const result = pointInTriangle(point, triangle);
    expect(result).toBe(true);
  });
  test("point inside triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [0.25, 0.25];
    const result = pointInTriangle(point, triangle);
    expect(result).toBe(true);
  });
  test("point outside triangle", () => {
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      1, 0, 30
    ]);
    const point = [1, 1];
    const result = pointInTriangle(point, triangle);
    expect(result).toBe(false);
  });
});

describe("barycentric", () => {
  test("inside triangle", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [1, Math.sqrt(3) / 2];
    const result = barycentric(point, triangle);
    expect(floatIsClose(result[0], 0.25, 1e-7)).toBe(true);
    expect(floatIsClose(result[1], 0.5, 1e-7)).toBe(true);
    expect(floatIsClose(result[2], 0.25, 1e-7)).toBe(true);
  });

  test("on edge", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      0, 1, 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [0, 1 / 2];
    const result = barycentric(point, triangle);
    expect(result[0]).toEqual(0.5);
    expect(result[1]).toEqual(0.5);
    expect(Math.abs(result[2])).toEqual(0);
  });

  test("outside triangle", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [1, 2 * Math.sqrt(3)];
    const result = barycentric(point, triangle);
    expect(floatIsClose(result[0], -0.5, 1e-7)).toBe(true);
    expect(floatIsClose(result[1], 2, 1e-7)).toBe(true);
    expect(floatIsClose(result[2], -0.5, 1e-7)).toBe(true);
  });

  test("interpolates correctly first vertex", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [0, 0];
    const result = barycentric(point, triangle);
    expect(result[0]).toEqual(1);
    expect(Math.abs(result[1])).toEqual(0);
    expect(Math.abs(result[2])).toEqual(0);
  });

  test("interpolates correctly second vertex", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [1, Math.sqrt(3)];
    const result = barycentric(point, triangle);
    expect(floatIsClose(result[0], 0, 1e-7)).toBe(true);
    expect(floatIsClose(result[1], 1, 1e-7)).toBe(true);
    expect(floatIsClose(result[2], 0, 1e-7)).toBe(true);
  });

  test("interpolates correctly third vertex", () => {
    // equilateral triangle with length 2 on each side
    // prettier-ignore
    const triangle = Float32Array.from([
      0, 0, 10,
      1, Math.sqrt(3), 20,
      2, 0, 30,
    ]);
    // Middle of triangle
    const point = [2, 0];
    const result = barycentric(point, triangle);
    expect(Math.abs(result[0])).toEqual(0);
    expect(Math.abs(result[1])).toEqual(0);
    expect(Math.abs(result[2])).toEqual(1);
  });
});
