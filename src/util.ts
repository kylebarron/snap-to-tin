import { TypedArray } from "./types";

/**
 * Efficiently filter elements by index from TypedArray
 *
 * This mutates the array in place, and returns a view on the array
 *
 * @param  {TypedArray} array       Array to filter
 * @param  {Array[int]} skipIndices Indices to remove
 * @param  {int} coordLength Number of coordinates per vertex
 * @return {TypedArray}             [description]
 */
export function filterArray(
  array: TypedArray,
  skipIndices: number[],
  coordLength: number
): TypedArray {
  // Copy all the data from skipIndices[i] to skipIndices[i + 1]
  for (let i = 0; i < skipIndices.length; i++) {
    // Start with next vertex after skipIndex
    const sourceStart = (skipIndices[i] + 1) * coordLength;
    // Continue until the next skipped index or to the end
    const sourceEnd = skipIndices[i + 1] * coordLength || array.length;
    // Fill into array, overwriting existing skipped indexes
    const target = (skipIndices[i] - i) * coordLength;
    array.copyWithin(target, sourceStart, sourceEnd);
  }

  return array.subarray(0, array.length - skipIndices.length * coordLength);
}
