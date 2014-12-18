var
  fs = require('fs'),
  gulp = require('gulp'),
  concat = require('gulp-concat'),
  uglify = require('gulp-uglify'),
  header = require('gulp-header'),
  footer = require('gulp-footer'),
  sourcemaps = require('gulp-sourcemaps'),
  buildTemplate, head, foot, concatOptions;

buildTemplate = fs.readFileSync('./build.template').toString().split('__JAVASCRIPT__CONTENT__');
head = buildTemplate[0];
foot = buildTemplate[1];
concatOptions = {
  'pkg': require('package')
};

gulp.task('build:dev', function () {
  return gulp.src('./src/**')
    .pipe(sourcemaps.init())
      .pipe(concat('ScreenManager.js'))
      .pipe(header(head, concatOptions))
      .pipe(footer(foot, concatOptions))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./build'));
});

gulp.task('build:min', function () {
  return gulp.src('./src/**')
    .pipe(sourcemaps.init())
      .pipe(concat('ScreenManager.min.js'))
      .pipe(header(head, concatOptions))
      .pipe(footer(foot, concatOptions))
    .pipe(sourcemaps.write())
    .pipe(uglify())
    .pipe(gulp.dest('./build'));
});

gulp.task('build', ['build:dev', 'build:min']);