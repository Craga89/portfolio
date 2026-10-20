---
title: "gulp-watch-less - Watch LESS @imports"
date: 2014-10-12
tags: [Plugins, JavaScript, Gulp, Node]
original: https://blog.craigsworks.com/gulp-watch-less
archived: https://web.archive.org/web/20161106041715/http://blog.craigsworks.com:80/gulp-watch-less/
---
I've recently released a new plugin aptly named `gulp-watch-less`, which will monitor your .less files using the excellent `gulp-watch` task, and output changed files to the stream whenever the file itself *or any of it's `@import`s* have changed.

It's usage is pretty straight forward, using the same signature as the underlying `gulp-watch` plugin:

```js
var gulp = require('gulp');
var watchLess = require('gulp-watch-less');
var less = require('gulp-less');

// LESS compilter configuration
var lessConfig = {
	paths: ['../imports']
};

gulp.task('less', function () {
    return gulp.src('**/*.less')
        .pipe(watchLess('less/file.less', {
        	name: 'LESS', // For output nice-ness!
            less: lessConfig // Passed to LESS parser when generating list of @imports
        }))
        .pipe(less(lessConfig))
        .pipe(gulp.dest('dist'));
});
```

Running `gulp less` will compile all .less files, and watch for changes to those watched and their `@imports`. Simple! *It will also monitor the original files for changes to `@import` statements (additions, deletions, path updates etc) to ensure the associated files are watched correctly!*

You can get the plugin using the usual `npm install gulp-watch-less` or visit the [GitHub project](https://github.com/Craga89/gulp-watch-less) for more documentation or to [report an issue](https://github.com/Craga89/gulp-watch-less/issues).

*Big thanks to [Vsevolod Strukchinsky](https://github.com/floatdrop) for the modifying his existing (and awesome!) `gulp-watch` plugin to make this possible.*

Happy building!
