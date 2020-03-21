import { TypedArray } from "./types";

/**
 * Efficiently filter elements by index from TypedArray
 *
 * This mutates the array in place, and returns a view on the array
 *
 * @param   array       Array to filter
 * @param   skipIndices Indices to remove
 * @param   coordLength Number of coordinates per vertex
 * @return              [description]
 */
export function filterArray<T extends TypedArray>(
  array: T,
  skipIndices: number[],
  coordLength: number
) {
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
