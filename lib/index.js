import {WebMercatorViewport} from '@deck.gl/core';
import {polygon} from '@turf/helpers';
import {getType} from '@turf/invariant';
import bbox from '@turf/bbox';
import RBush from 'rbush';


// Get triangles from terrain
var constructRTree = (options = {}) => {
    // Not sure if the lat, lon, zoom options for WebMercatorViewport are required
    var {terrain, viewport = new WebMercatorViewport()} = options;

    // triples of position indices that make up the faces of the terrain
    var indices = terrain.indices.value;
    // x, y, z positions in space of each index
    var positions = terrain.attributes.POSITION.value

    // Create list of objects for insertion into RTree
    var rtreeTriangles = []

    for (let i = 0; i < indices.length; i+=3) {
        // The indices within `positions` of the three vertices of the triangle
        var aIndex = indices[i]
        var bIndex = indices[i + 1]
        var cIndex = indices[i + 2]

        // The three vertices of the triangle, where each vertex is an array of [x, y, z]
        var a = positions.subarray(aIndex * 3, (aIndex + 1) * 3)
        var b = positions.subarray(bIndex * 3, (bIndex + 1) * 3)
        var c = positions.subarray(cIndex * 3, (cIndex + 1) * 3)

        // For now I'm assuming these vertices are coming from loaders.gl's TerrainLoader
        // So I'm assuming these are in web mercator coordinates
        // unprojectFlat only keeps x and y, so here I keep the z coord as well
        var aProj = [...viewport.unprojectFlat(a), a[2]]
        var bProj = [...viewport.unprojectFlat(b), b[2]]
        var cProj = [...viewport.unprojectFlat(c), c[2]]

        // Create polygon from these coords
        var geom = polygon([[aProj, bProj, cProj, aProj]])

        // Get bounding box of triangle for insertion into rtree
        var [minX, minY, maxX, maxY] = bbox(geom);

        // Make object that will be inserted into RTree
        var rtreeTriangle = {
            minX,
            minY,
            maxX,
            maxY,
            geometry: geom,
        }
        rtreeTriangles.push(rtreeTriangle)
    }

    var tree = new RBush();
    tree.load(rtreeTriangles)
    return tree;
}

