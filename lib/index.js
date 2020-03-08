import {WebMercatorViewport} from '@deck.gl/core';
import {polygon as Polygon, lineString as LineString, point as Point} from '@turf/helpers';
import {getType} from '@turf/invariant';
import bbox from '@turf/bbox';
import RBush from 'rbush';
import pointInPolygon from '@turf/boolean-point-in-polygon'
import barycentric from "barycentric"
import lineIntersect from '@turf/line-intersect'



// Get triangles from terrain
function constructRTree(options = {}) {
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
        var geom = Polygon([[aProj, bProj, cProj, aProj]])

        // Get bounding box of triangle for insertion into rtree
        var [minX, minY, maxX, maxY] = bbox(geom);

        // Make object that will be inserted into RTree
        var rtreeTriangle = {
            minX,
            minY,
            maxX,
            maxY,
            feature: geom,
        }
        rtreeTriangles.push(rtreeTriangle)
    }

    var tree = new RBush();
    tree.load(rtreeTriangles)
    return tree;
}

// Find elevation of point
function handlePoint(point, tree) {
    // Not sure why my points are outside the bbox of the tree
    // point = feature.geometry.coordinates
    // searchPoint
    // tree.data.minX <= point[0]
    // tree.data.maxX >= point[0]
    // tree.data.minY <= point[1]
    // tree.data.maxY >= point[1]

    var point = [-121.81983947753906, 46.2]
    var searchPoint = {minX: point[0], minY: 46.2, maxX: point[0], maxY: 46.2}
    var results = tree.search(searchPoint)

    // Check each result
    // Since I'm working with triangles and not square boxes, it's possible that a point could be
    // inside the triangle's bounding box but outside the triangle itself.
    var filteredResults = results.filter(result => {
        // TODO figure out how to handle points on the boundary
        // As of now, the point is ignored if on the boundary
        if (pointInPolygon(point, result.feature)) return result
    })

    // There should generally be 1 result in filteredResults
    // There could currently be 0 because I'm not including points on the boundary
    // If I switch that on, there could be 2, if a point is on a boundary edge, or >2 if a point coincides with a triangle vertex
    if (filteredResults.length !== 1) {
        throw new Error("incorrect length of results from rtree")
    }

    // Now linearly interpolate elevation within this triangle
    var filteredResult = filteredResults[0]
    const triangle = filteredResult.feature.geometry.coordinates[0];
    var interpolatedPoint = interpolateTriangle(triangle[0], triangle[1], triangle[2], point)
    return Point(interpolatedPoint)
}

// a, b, c must be arrays of three elements
// point must be an array of two elements
// TODO: add tests where you assert that the interpolated z is above the min vertex height and below
// the max vertex height
function interpolateTriangle(a, b, c, point) {
    const [ax, ay, az] = a
    const [bx, by, bz] = b
    const [cx, cy, cz] = c

    // Find the mix of a, b, and c to use
    const mix = barycentric([[ax, ay], [bx, by], [cx, cy]], point.slice(0, 2))

    // Find the correct z based on that mix
    const interpolatedZ = (mix[0] * az) + (mix[1] * bz) + (mix[2] * cz)

    return [point[0], point[1], interpolatedZ];
}

// Add coordinates for LineString
function handleLineString(line, tree) {
    // var line = [[-121.81983947753906, 46.2], [-121.83, 46.23]]
    var lineGeometry = LineString(line)

    let coordsWithZ = []

    // Loop over each line segment
    for (let i = 0; i < line.length - 1; i++) {
        var a = line[i];
        var b = line[i + 1]

        // Find edges that this line segment crosses
        var searchBbox = {
            minX: Math.min(a[0], b[0]),
            minY: Math.min(a[1], b[1]),
            maxX: Math.max(a[0], b[0]),
            maxY: Math.max(a[1], b[1])
        }
        var results = tree.search(searchBbox)

        // Find points where line crosses edges
        // intersectionPoints is [Feature[Point]]
        // Note that intersectionPoints has 2x duplicates!
        // This is because every edge crossed is part of two triangles!
        var intersectionPoints = results.flatMap(result => {
            const intersection = lineIntersect(lineGeometry, result.feature.geometry)
            if (intersection.features.length === 0) return [];

            // Otherwise, has an intersection point(s)
            const newPoints = []
            const triangle = result.feature.geometry.coordinates[0]
            for (const int of intersection.features) {
                const point = int.geometry.coordinates;
                const newPoint = interpolateTriangle(triangle[0], triangle[1], triangle[2], point)
                newPoints.push(newPoint)
            }

            return newPoints;
        })

        // Quick and dirty deduplication
        // Since interpolateTriangle appears to be working now, this just deduplicates on the first
        // element.
        // TODO: make more performant; Remove lodash dependency
        var uniqCoords = _.uniqBy(intersectionPoints, x => x[0])

        // sort points in order from start to end
        var deltaX = b[0] - a[0]
        var deltaY = b[1] - a[1]
        let sorted;
        if (deltaX > 0) {
            sorted = _.orderBy(uniqCoords, c => c[0], 'asc')
        } else if (deltaX < 0) {
            sorted = _.orderBy(uniqCoords, c => c[0], 'desc')
        } else if (deltaY > 0) {
            sorted = _.orderBy(uniqCoords, c => c[1], 'asc')
        } else if (deltaY < 0) {
            sorted = _.orderBy(uniqCoords, c => c[1], 'desc')
        } else {
            throw new Error('start and end point same???')
        }

        var newA = handlePoint(a, tree)
        coordsWithZ.push(newA)
        coordsWithZ = coordsWithZ.concat(sorted);
    }

    var endPoint = line.slice(-1)[0]
    coordsWithZ.push(handlePoint(endPoint, tree))
    return LineString(coordsWithZ)
}