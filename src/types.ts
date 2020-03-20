export type FloatArray = Float32Array | Float64Array;
export type IntegerArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray;

export type PointZ = number[] | FloatArray;
export type Point = number[] | FloatArray;
export type TriangleZ = FloatArray;
export type LineSegment = Point[];
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;
