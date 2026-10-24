---
title: "LESS - Generate a deep list of all a file's @imports"
date: 2014-10-05
tags: [JavaScript, LESS]
original: https://blog.craigsworks.com/less-file-import-list/
archived: https://web.archive.org/web/20170805024745/http://blog.craigsworks.com:80/less-file-import-list/
---
Sometimes it's useful to get a list of all `@import`s for a given `.less` file, especially if you want to watch those files for changes in your `gulp` or `grunt` build steps. We can easily achieve this using the LESS parser itself!

```js
var fs = require('fs'),
	less = require('less');

module.exports = function(path, opts, cb) {
	// Support (path, cb) signature
	if(typeof opts === 'function') {
		cb = opts; opts = null;
	}

	// Read the file (async)
	fs.readFile(path, function(err, source) {
		if(err) { throw new Error(err); }

		// Setup options
		opts || (opts = {});
		opts.filename = path;

		// Create new parser instance
		parser = new less.Parser(opts);

		// Parse the source into AST tree via LESS
		parser.parse(source.toString('utf8'), function (err, tree) {
			if (err) { throw new Error(err); } 

			// Return array of all `@import`ed files via the parsers `imports` object!
			cb(Object.keys(parser.imports.files));
		});
	});
};
```

> Disclaimer... **this relies on internal implementation details of the LESS.js library** and as such *could break at any time*. That being said, **this code should work on all LESS.js versions stretching right back to `v1.3`**!

## Sample use

```js
var getImports = require('./lessImportList');

// Sample usage - log all @import paths to the console :)
getImports('less/themes/default/app.less', function(imports) {
	console.log(imports); // Log to the console
});
```

## gulp-watch-less

I've rolled the above code into a `gulp` plugin called [gulp-watch-less](https://github.com/Craga89/gulp-watch-less), which works exactly like the [gulp-watch](https://github.com/floatdrop/gulp-watch) plugin but also tracks changes to all `@import` paths of the files. Neat!

Take a look at the [official repo](https://github.com/Craga89/gulp-watch-less) for more information on how to use this in your work flow
