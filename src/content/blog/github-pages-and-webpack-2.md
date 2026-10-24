---
title: "GitHub Pages + Webpack Chunks = output.publicPath"
date: 2015-07-26
tags: []
original: https://blog.craigsworks.com/github-pages-and-webpack-2
archived: https://web.archive.org/web/20160817033812/http://blog.craigsworks.com/github-pages-and-webpack-2/
---
If you're looking to use compiled a Webpack application with chunks in your `gh-pages` repository, you'll need to make sure your `output.publicPath` is set properly in your `webpack.config.js` (or similar) file, otherwise your chunks will probably have the wrong URL!

Simply set up your `output.publicPath` to point to the output directory, prefixed with the name of your GitHub project. For example my `durandal-webpack` compiles to a `dist/` directory, and it's `publicPath` points to...

```javascript
output: {  
    // ...other config here
    publicPath: '/durandal-webpack/dist/'
}
```

**You'll also need to update your `index.html` to make sure the `<script>` referencing your compiled file reflects this change!**

Took me a few tries to understand why my chunks weren't loading, so hope this saves you some of that debugging pain!

*Hint: This also works well with [webpack-dev-server](https://webpack.github.io/docs/webpack-dev-server.html). Awesome.*
