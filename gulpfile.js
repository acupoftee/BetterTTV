const autoprefixer = require('autoprefixer');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const concat = require('gulp-concat');
const del = require('del');
const eslint = require('gulp-eslint');
const fs = require('fs');
const git = require('git-rev-sync');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gzip = require('gulp-gzip');
const header = require('gulp-header');
const hexrgba = require('postcss-hexrgba');
const postcss = require('gulp-postcss');
const postcssUrl = require('postcss-url');
const precss = require('precss');
const rename = require('gulp-rename');
const saveLicense = require('uglify-save-license');
const server = require('./dev/server');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');
const tar = require('gulp-tar');
const uglify = require('gulp-uglify');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = process.env.NODE_ENV === 'production';

process.env.DEV_CDN_PORT = 2888;
process.env.DEV_CDN_ENDPOINT = `http://127.0.0.1:${process.env.DEV_CDN_PORT}/`;
process.env.PROD_CDN_ENDPOINT = 'https://cdn.betterttv.net/';

process.env.EXT_VER = require('./package.json').version;
process.env.GIT_REV = git.long();
process.env.SENTRY_URL = process.env.SENTRY_URL || 'https://24dfd2854f97465da5fb14fcea77278c@sentry.io/144851';
process.env.CDN_ENDPOINT = IS_PROD ? process.env.PROD_CDN_ENDPOINT : process.env.DEV_CDN_ENDPOINT;

const LICENSE = `/** @license
 * ${fs.readFileSync('LICENSE').toString().replace(/\n/g, '\n * ')}
 */
`;

gulp.task(
    'css',
    () => gulp.src('src/**/*.css')
        .pipe(postcss([
            precss,
            autoprefixer,
            hexrgba,
            postcssUrl({url: asset => `${process.env.CDN_ENDPOINT}${asset.url}`})
        ]))
        .pipe(concat('betterttv.css'))
        .pipe(gulp.dest('build'))
);

gulp.task(
    'cleanup',
    () => del('build/**/*')
);

gulp.task(
    'lint',
    () => gulp.src('src/**/*.js')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError())
);

gulp.task(
    'prepare',
    gulp.series(
        'cleanup',
        'lint',
        () => gulp.src('src/**/*')
            .pipe(gulp.dest('build'))
    )
);

gulp.task(
    'license',
    gulp.series('prepare',
        () => gulp.src('build/index.js')
            .pipe(header(LICENSE + '\n'))
            .pipe(gulp.dest('build'))
    )
);

gulp.task(
    'scripts',
    gulp.series(
        'license',
        'css',
        () => browserify('build/index.js', {debug: true})
            .transform('require-globify')
            .transform('babelify', {
                global: true,
                presets: ['@babel/preset-env'],
                plugins: ['@babel/plugin-transform-runtime'],
                ignore: [/node_modules\/(?!draggy)/]
            })
            .transform('envify')
            .bundle()
            .pipe(gulpif(IS_PROD, source('betterttv.unmin.js'), source('betterttv.js')))
            .pipe(buffer())
            .pipe(gulp.dest('build'))
            .pipe(gulpif(IS_PROD, rename('betterttv.js')))
            .pipe(gulpif(IS_PROD, sourcemaps.init({loadMaps: true})))
            .pipe(gulpif(IS_PROD, uglify({output: {comments: saveLicense}})))
            .pipe(gulpif(IS_PROD, sourcemaps.write('./')))
            .pipe(gulpif(IS_PROD, gulp.dest('build')))
    )
);

gulp.task(
    'server',
    () => server()
);

gulp.task(
    'default',
    gulp.series('scripts')
);

gulp.task(
    'watch',
    gulp.parallel(
        'default',
        'server',
        () => gulp.watch('src/**/*', gulp.series('default'))
    )
);

gulp.task(
    'dist',
    gulp.series(
        'scripts',
        () => gulp.src('build/**/*')
            .pipe(tar('betterttv.tar'))
            .pipe(gzip())
            .pipe(gulp.dest('dist'))
    )
);
