---
title: "LESS - Generate a deep list of all a file's @imports"
date: 2014-10-05
tags: [JavaScript, LESS]
original: https://blog.craigsworks.com/less-file-import-list/
archived: https://web.archive.org/web/20170805024745/http://blog.craigsworks.com:80/less-file-import-list/
---
Sometimes it's useful to get a list of all `@import`s for a given `.less` file, especially if you want to watch those files for changes in your `gulp` or `grunt` build steps. We can easily achieve this using the LESS parser itself!

[See the code on GitHub](https://gist.github.com/96f7fcad1f35b08bf88d)

> Disclaimer... **this relies on internal implementation details of the LESS.js library** and as such *could break at any time*. That being said, **this code should work on all LESS.js versions stretching right back to `v1.3`**!

#### Sample use

[See the code on GitHub](https://gist.github.com/96f7fcad1f35b08bf88d)

#### gulp-watch-less

I've rolled the above code into a `gulp` plugin called [gulp-watch-less](https://github.com/Craga89/gulp-watch-less), which works exactly like the [gulp-watch](https://github.com/floatdrop/gulp-watch) plugin but also tracks changes to all `@import` paths of the files. Neat!

Take a look at the [official repo](https://github.com/Craga89/gulp-watch-less) for more information on how to use this in your work flow
