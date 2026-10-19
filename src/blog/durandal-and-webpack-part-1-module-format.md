---
title: "Durandal and Webpack: Part 1 - Module format"
date: 2015-07-26
tags: [Knockout.js, Durandal, jQuery, Webpack, Guide, Require.js]
original: https://blog.craigsworks.com/durandal-and-webpack-part-1-module-format/
archived: https://web.archive.org/web/20180628012752/http://blog.craigsworks.com/durandal-and-webpack-part-1-module-format/
---
*This post is part of a series of posts entitled **Durandal and Webpack**. Check-out the [Introduction](http://blog.craigsworks.com/durandal-and-webpack-introduction) here if you haven't already, as well as the [online examples](http://craga89.github.io/durandal-webpack)*

## AMD

Durandal's core is written using the Asynchronous Module Definition pattern, which allows users to define their module and load their dependencies asynchronously, a must have for any web-based application. It takes the following form:

[See the code on GitHub](https://gist.github.com/4f34e9cf972456f505df)

For example, Durandal's `viewEngine` module has a dependency on it's own `system` module, as well as jQuery, and is written as:

[See the code on GitHub](https://gist.github.com/4f34e9cf972456f505df)

This syntax will likely comprise the large majority of your existing application code, and whilst *Webpack can understand this format natively*, the benefits on enclosing the whole module within a closure are lost. Since Webpack bundles the modules within the same script, we no longer require an asynchronous definition format, and can instead opt for the simpler CommonJS alternative..

## CommonJS

The CommonJS module format is the synchronous sibling to AMD, and is the primary module format for Node.js, which I'm sure you'll all be familiar with. It has a slightly different syntax to AMD. For example, here's the previous `viewEngine` module rewritten in CommonJS syntax:

[See the code on GitHub](https://gist.github.com/4f34e9cf972456f505df)

Note some of the key differences here:

1. No `define` method or closure. Your code is isolated by default, and requires explicit export.
2. Dependencies are denoted and retrieved by the use of the `require` method.
3. Exporting functionality is done using the special `module` variable, as opposed to a `return` statement.

Though this may appear more verbose the the equivalent AMD syntax, it's arguably more readable, and does away with the need for additional closures within your code.

## Okay... so what?

As stated before, **Webpack natively understands the AMD `define` method and it's syntax**, so you don't have to do anything right away. In fact, you could continue on using the same syntax you've been using and everything should bundle as expected.

I would however recommend taking up the CommonJS format for future code, and slowly migrating old code to it where feasible. The advantages of the AMD approach are lost with bundlers like Webpack, and in my opinion make your code less readible.

**CommonJS is the format I'll be using throughout this guide when dealing with code samples.**

###### **A quick note on ES6**

With

ES6 compatibility gaining traction

, and the rise of transpilers such as

Babel

, the new

ES6 module format

is gaining widespread adoption and looks to be the future standard of modular development for us JavaScript developers. If you're interested, take a look at

babel-loader

and the

Babel documentation

on it.

##### Next Chapter: [Durandal and Webpack: Part 2 - Composition](http://blog.craigsworks.com/durandal-and-webpack-part-2-composition)
