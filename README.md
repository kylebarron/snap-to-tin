# snap-to-tin

[![Build Status](https://travis-ci.org/kylebarron/snap-to-tin.svg?branch=master)](https://travis-ci.org/kylebarron/snap-to-tin)

Snap vector features to the faces of a triangulated irregular network (TIN).

## Overview

Given a TIN representing a terrain mesh, this snaps 2D `Point` and `LineString`
features to the faces of that mesh.

For `Point` features, this finds the triangle containing that point and linearly
interpolates from the heights of the triangle's vertices to find the point's
elevation.

For `LineString` features, this finds the elevation of every vertex using the
same method as for `Point`s, but also finds every intersection between each
`LineString` segment and triangle edges. At each segment-edge intersection, a
new vertex is added to the resulting `LineString`, so that every part of the
`LineString` is attached to a face of the mesh.

## Install

```bash
yarn add @kylebarron/snap-to-tin
# or
npm install @kylebarron/snap-to-tin
```

## Usage

**Note that the coordinates of the TIN and the vector features need to be in the
same coordinate system.**

```js
import snapFeatures from '@kylebarron/snap-to-tin'
import {load} from '@loaders.gl/core';
import {TerrainLoader} from '@loaders.gl/terrain';

// Load and parse terrain mesh
const terrain = await load(terrainImage, TerrainLoader);

// Construct class
const snap = new SnapFeatures({
  // triples of position indices that make up the faces of the terrain
  indices: terrain.indices.value,
  // x, y, z positions in space of each index
  positions: terrain.attributes.POSITION.value,
  // Optional bounding box to clip features to
  bounds: [0, 0, 1, 1]
})

// array of GeoJSON features
const features = [...]
const snappedFeatures = snap.snapFeatures({features})
```

## API

The default export is a class: `SnapFeatures`.

### `SnapFeatures` constructor

Admits an object with the following keys:

- **`indices`**: a flat TypedArray with triples of indices referring to `positions` of the triangles that make up the TIN. Each triple refers to a triangle face. So `[1, 3, 4, ...]` would mean that the second, fourth, and fifth (since zero-indexed) set of coordinates in `positions` constitute a triangle face.
- **`positions`**: a flat TypedArray with x, y, z coordinates of the triangles. So `[0.25, 0.5, 625, ...]` would mean that the first position, i.e. `0` in `indices`, has position `x=0.25`, `y=0.5`, `z=625` in the given coordinate space.
- **`bounds`**: (optional) an array of `[minX, minY, maxX, maxY]` to be used for clipping features. This is used to clip vector features, since heights cannot be found for positions outside the extent defined by the `positions` array. If provided, `bounds` will be intersected with the maximal bounds from the `positions` array. Default: maximum extent of `positions`

    This is especially useful with features generated from vector tiles, since vector tiles usually have buffer outside the geographic extent it represents.

### `SnapFeatures.snapFeatures()`

Snap GeoJSON `Point` and `LineString` features to the TIN. Admits an object with
the following keys:

- **`features`**: an array of GeoJSON `Feature`s, containing 2D `Point` and `LineString` geometries. Other geometry types will be silently skipped.

Returns new GeoJSON features with 3D coordinates.

### `SnapFeatures.snapPoints()`

Snap a TypedArray of points to the TIN.

- **`positions`**: a flat TypedArray with positions of 2D `Point` geometries.

  Note that this is different from the `positions` given to the constructor,
  which are the positions of the triangles of the TIN. These are the positions
  of `Point`s on the TIN.

- **`featureIds`**: Optional, a flat TypedArray with `featureIds`, one per
  vertex. If provided, a similar TypedArray will be returned. Since some input
  points can be omitted from the output (e.g. if outside the bounds of the TIN),
  this helps to keep track of which snapped point has which properties. This
  must be the same length as the number of vertices within `positions`. So if
  `positions` holds five 2D coordinates, the length of `positions` should be 10
  and the length of `featureIds` should be 5.

Returns:

```js
{
  // A flat TypedArray containing 3D coordinates for each point
  positions: TypedArray,
  // If provided as input, a mutated featureIds array for each snapped vertex
  featureIds: TypedArray,
}
```

### `SnapFeatures.snapLines()`

Snap a TypedArray of lines to the TIN.

- **`positions`**: a flat TypedArray with positions of 2D `LineString` geometries.

  Note that this is different from the `positions` given to the constructor,
  which are the positions of the triangles of the TIN. These are the positions
  of `LineString`s on the TIN.

- **`pathIndices`**: a flat TypedArray with indices of where each individual
  `LineString` starts. For example, if there are 3 paths of 2, 3, and 4 vertices
  each, `pathIndices` should be `[0, 2, 5, 9]`. Note, this must have length `n + 1`, where `n` is the number of vertices. If not provided, assumed the entire
  `positions` array constitutes a single `LineString`.

- **`featureIds`**: Optional, a flat TypedArray with `featureIds`, one per
  vertex. If provided, a similar TypedArray will be returned. Since some input
  lines can be omitted from the output (e.g. if outside the bounds of the TIN),
  this helps to keep track of which snapped vertex has which properties. This
  must be the same length as the number of vertices within `positions`. So if
  `positions` holds five 2D coordinates, the length of `positions` should be 10
  and the length of `featureIds` should be 5.

Returns:

```js
{
  // A flat TypedArray containing 3D coordinates for each point
  positions: TypedArray,
  // A flat TypedArray with indices of where each snapped `LineString` starts
  pathIndices: TypedArray,
  // If provided as input, a mutated featureIds array for each snapped vertex
  featureIds: TypedArray,
}
```

### Use with `TypedArray`s

This library is designed to support `TypedArray`s (through the `snapPoints` and
`snapLines` methods) in order to achieve maximum performance. When using web
workers, passing `TypedArray`s is most efficient because it allows for bypassing
serialization and deserialization of the data. In the next release, loaders.gl
[will have support](https://github.com/uber-web/loaders.gl/pull/690) for reading
Mapbox Vector Tiles directly into `TypedArray`s. Deck.gl [also
supports](https://deck.gl/#/documentation/developer-guide/performance-optimization?section=use-binary-data)
passing binary `TypedArray`s as data to its layers. So the process of

1. Loading vector geometries
2. Snapping features to the TIN
3. Passing to deck.gl layers

should be quite fast, and additionally there would be little main-thread
performance cost to doing #2 on a worker thread.
