---
title: Durandal - Type cast queryString parameters
date: 2014-07-28
tags: []
original: https://blog.craigsworks.com/durandal-type-cast-querystring-parameters/
archived: https://web.archive.org/web/20150315021447/http://blog.craigsworks.com/durandal-type-cast-querystring-parameters/
---
By default, Durandal's `router.parseQueryString` method will simply provide all query parameters as `string`s, which isn't ideal if you're working with data heavily.

We can work around this by overwriting and enhancing the `parseQueryString` method, type casting variables into their correct types.

[See the code on GitHub](https://gist.github.com/a3f11a458c8b662e9046)

*This is useful for primitive data types, but as usual YMMV depending on the type of data you're attempting to pass through!*
