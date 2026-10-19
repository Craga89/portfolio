---
title: Durandal - Type cast queryString parameters
date: 2014-07-28
tags: []
original: https://blog.craigsworks.com/durandal-type-cast-querystring-parameters/
archived: https://web.archive.org/web/20150315021447/http://blog.craigsworks.com/durandal-type-cast-querystring-parameters/
---
By default, Durandal's `router.parseQueryString` method will simply provide all query parameters as `string`s, which isn't ideal if you're working with data heavily.

We can work around this by overwriting and enhancing the `parseQueryString` method, type casting variables into their correct types.

```js
/**
AMD module, **to be included before the rest of your durandal app**, that enhances
the native `router.parseQueryString` method, providing query parameters in their
correct primitive type, rather than always as strings.

@module Durandal.Router.Addons 
**/
define('plugins/router', function(router) {
    /**
    Parses a query string into an object, attempting to parse each query string param
    into a proper type
    
    @method parseQueryString
    @for Durandal.Router
    @param {String} queryString The query string to parse.
    @return {Object} An object keyed according to the query string parameters.
    **/
    var _parseQueryString = router.parseQueryString;
    router.parseQueryString = function () {
        var queryObject = _parseQueryString.apply(this, _.rest(arguments)),
            val, key;
    
        for(key in queryObject) {
            val = queryObject[key];
    
            // Float
            if (/^[+-]?[0-9]+\.[0-9]*$/.test(val)) {
                val = parseFloat(val);
            }
    
            // Integer
            else if (/^[+-]?[0-9]+$/.test(val)) {// simple int regex
                val = parseInt(val, 10);
            }
    
            // Booleans
            val = (!val && val !== 0) ? true : val;
            (val === 'true') && (val = true);
            (val === 'false') && (val = false);
    
            // Couldn't convert it, use the original value!
            if (val !== false && val !== true && !_.isNumber(val)) {
                val = val;
            }
    
            // Set the new value
            queryObject[key] = val;
        }
    
        return queryObject;
    };
});
```

*This is useful for primitive data types, but as usual YMMV depending on the type of data you're attempting to pass through!*
