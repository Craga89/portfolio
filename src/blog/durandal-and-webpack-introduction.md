---
title: "Durandal and Webpack: Introduction"
date: 2015-07-26
tags: [Knockout.js, Durandal, jQuery, Webpack, Guide, Require.js]
original: https://blog.craigsworks.com/durandal-and-webpack-introduction
archived: https://web.archive.org/web/20180727075201/http://blog.craigsworks.com:80/durandal-and-webpack-introduction/
---
This series of posts will explain how to utilise the power of the [Webpack](http://webpack.github.io/) module bundler with an existing (or perhaps new) [Durandal](http://durandaljs.com/) application. But first...

### A bit of background

[Durandal](http://durandaljs.com/) is a mature SPA framework built atop popular existing libraries: [Knockout.js](http://knockoutjs.com/), [Require.js](http://requirejs.org/) and [jQuery](http://jquery.com/). It allows users to use a modular, MVC-like approach to SPA development, via it's extensive use of Require.js. This is a great starting workflow, allowing users to quickly create applications with little to no boilerplate outside Durandal itself, which lends itself well to agile development environments.

[Webpack](http://webpack.github.io/) is "module bundler", which allows users to take a given set of modular JavaScript files, and compile them down into a single (or multiple) file(s). Not only that, but it also allows us to bundle in other file formats such as `CSS` and `HTML` via the use of [module loaders](https://webpack.github.io/docs/loaders.html). This effectively allows us to represent the whole application as a single, pre-built, minified file, assets and all. Perfect for production environments that need extensive caching and minimal network activity!

### Using them together

Durandal already supports bundling your app via the [r.js](http://requirejs.org/docs/optimization.html) bundler, but it's more than possible to utilise the advanced features of Webpack in place of this, and gain a lot more freedom in the process, particuarly relating to bundling other CSS and HTML assets!

One exciting possibility is the use of [ES6/7 code](http://es6-features.org/#Constants) within your Durandal application via the use of [Babel](https://babeljs.io/) and Webpacks [babel-loader](https://github.com/babel/babel-loader) which, while not covered in this blog series, is an exciting step forward for developers and applications alike. [Make sure to look into this!](http://www.2ality.com/2015/04/webpack-es6.html)

### Okay... then how?

Using Webpack with Durandal requires some changes not only to our code, but to our workflow. Durandal was originally designed for use within an [AMD](http://requirejs.org/docs/whyamd.html) environment, as opposed to the [CommonJS](http://requirejs.org/docs/commonjs.html) approach those of you with [Node.js](http://nodejs.org/) experience will be familiar with. We'll need to adapt our existing code to fit within this CommonJS syntax, and hopefully make things more readable in the process!

Along with this, we'll need to [monkey-patch](http://github.com/Craga89/durandal-webpack/tree/master/app/overrides) Durandal's internals with some additional functionality, which will let us use static dependencies for our Views, Dialogs, and Router(s). Don't worry, this functionality is entirely backwards compatible, and can be used for new features going forward, whilst still maintaining compatibility with old code!

### Show me the money!

If you're a code monkey and prefer to dredge through the code yourself, checkout the [durandal-webpack](http://github.com/Craga89/durandal-webpack) GitHub repository, as well as the [Online examples](http://craga89.github.io/durandal-webpack) produced via it's `gh-pages` branch.

##### Next Chapter: [Durandal and Webpack: Part 1 - Module Format](http://blog.craigsworks.com/durandal-and-webpack-part-1-module-format)
