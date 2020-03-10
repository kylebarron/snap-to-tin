# snap-features-to-terrain

Add z-coordinates to vector features on the fly.

## Overview

Given a triangular irregular network (TIN) representing a terrain mesh, this
snaps 2D `Point` and `LineString` features to that mesh.

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
yarn add @kylebarron/snap-features-to-terrain
# or
npm install @kylebarron/snap-features-to-terrain
```

## Usage

The single exported method is `snapFeatures`, which takes `indices`, `positions`, `features`,
and `bounds` as arguments.

- **`indices`**: a flattened Array or TypedArray with triples of indices referring to `positions`. Each triple refers to a triangle face. So `[1, 3, 4, ...]` would mean that the second, fourth, and fifth (since zero-indexed) set of coordinates in `positions` constitute a triangle face.
- **`positions`**: a flattened Array or TypedArray with x, y, z coordinates. So `[0.25, 0.5, 625, ...]` would mean that the first position, i.e. `0` in `indices`, has position `x=0.25`, `y=0.5`, `z=625` in the given coordinate space.
- **`features`**: an array of 2D `Point` and `LineString` GeoJSON features. Other geometry types will be silently skipped.
- **`bounds`**: an array of `[minX, minY, maxX, maxY]` to be used for clipping features. This is useful with features generated from vector tiles, since vector tiles usually have buffer outside the geographic extent it represents. But it's not possible to snap features outside the extent of the terrain mesh. Default: `null`.

**Note that the coordinates of both `features` and `positions` need to be in the
same coordinate system.**


### Example

```js
import {snapFeatures} from '@kylebarron/snap-features-to-terrain'
import {load} from '@loaders.gl/core';
import {TerrainLoader} from '@loaders.gl/terrain';

// array of GeoJSON features
const features = [...]

// Terrain mesh, generated from MARTINI
const terrain = await load(terrainImage, TerrainLoader);

// triples of position indices that make up the faces of the terrain
const indices = terrain.indices.value;

// x, y, z positions in space of each index
const positions = terrain.attributes.POSITION.value;

// bounding box to clip features to
// to turn off clipping, pass `bounds: null` (the default).
const bounds = [0, 0, 1, 1]

// Snap GeoJSON features to the mesh
// snappedFeatures is an Array of Features
const snappedFeatures = snapFeatures({indices, positions, features, bounds})
```
