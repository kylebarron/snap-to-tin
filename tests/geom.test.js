import { pointOnLine } from "../lib/geom";

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
