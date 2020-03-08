import {terser} from 'rollup-plugin-terser';

const config = (file, plugins = []) => ({
    input: 'lib/index.js',
    output: {
        name: 'snap-features-to-mesh',
        format: 'umd',
        indent: false,
        file
    },
    plugins
});

export default [
    config('snap-features-to-mesh.js'),
    config('snap-features-to-mesh.min.js', [terser()])
];
