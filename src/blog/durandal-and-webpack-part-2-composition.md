---
title: "Durandal and Webpack: Part 2 - Composition"
date: 2015-07-26
tags: []
original: https://blog.craigsworks.com/durandal-and-webpack-part-2-composition/
archived: https://web.archive.org/web/20180628012739/http://blog.craigsworks.com/durandal-and-webpack-part-2-composition/
---
*This post is part of a series of posts entitled **Durandal and Webpack**. Check-out the [Introduction](http://blog.craigsworks.com/durandal-and-webpack-introduction) here if you haven't already, as well as the [online examples](http://craga89.github.io/durandal-webpack)*

[Durandal](http://durandaljs.com/) implements a process known as [composition](http://durandaljs.com/documentation/Using-Composition.html), which allows developers to compose arbitrary Views and ViewModels together into a single output. Much like how [React](https://facebook.github.io/react/) lets you nest Components within your `render` method. This `composition` workflow is used extensively in Durandal and is the process by which your `ViewModel` and `View`(s) are stitched together to create the basic building blocks of your application.

By default, the `composition` engine deals with what are known in Durandal as `moduleId`s and `viewUrl`s, which are URLs that point to where the `ViewModel` or `View` are situated, respectively. Since Webpack doesn't understand this natively, we'll need to enhance this functionality a little and **allow us to directly pass the module, rather than a path pointing to it**.

### system.acquire

The logic for this method is fairly straight forward, taking a single `moduleId` string and returning a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) instance that resolves with the `module`:

```js
system.acquire = function(moduleId: String) {}
```

We'll override this method to allow the `moduleId` to be either a **`String` or a `Function`**. In the latter case, this function is given a single argument, another function we'll call `cb`, which takes the following form:

```js
function cb(err?: Error, module: Object|Function)
```

The `cb` function should be called with `null` as the first argument if no error occurred, and the resolved `module` as the second parameter. This may look familiar to you if you've used Node extensively, as it's the [standard Node.js callback pattern](http://fredkschott.com/post/2014/03/understanding-error-first-callbacks-in-node-js/).

With this in mind, let's take a look at the override in full:

```js
var system = require('durandal/system');

var acquire = system.acquire;
system.acquire = function(moduleIdOrModule) {
    var moduleType = typeof moduleIdOrModule;

    if(moduleType !== 'string') {
        return system.defer(function(dfd) {
            // If the moduleId is a funcction...
            if(moduleIdOrModule instanceof Function) {
                // Execute the funcction, passing a callback that should be 
                // called when the (possibly) async operation is finished
                var result = moduleIdOrModule(function(err, module) {
                    if(err) { dfd.reject(err); }
                    dfd.resolve(module);
                });

                // Also allow shorthand `return` from the funcction, which 
                // resolves the Promise with whatever was immediately returned
                if(result !== undefined) {
                    dfd.resolve(result);
                }
            }

            // If the moduleId is actually an object, simply resolve with it
            else {
                dfd.resolve(moduleIdOrModule);
            }
        });
    }

    // super()
    return acquire.apply(this, arguments);
};
```

This may look complex, but basically all it's allowing you to do is specify `moduleId` as a `Function`, which can either return the `module` directly, or execute a passed callback when you've retrieved it asynchronously (more on why we want this later!).

### viewLocator.locateView

The logic for this method is a little more complex, but we're only interested in the first parameter:

```js
viewLocator.locateView = function(  
    viewOrUrlOrId: String|DOMElement,
    area?: String,
    elementsToSearch?: DOMElement[]
) {}
```

We'll need to override this method to allow the `viewOrUrlOrId` to be a bare HTML string (a `String` whose first character is a `<`).

```js
var $ = require('jquery');
var system = require('durandal/system');
var viewLocator = require('durandal/viewLocator');

// Allow using `function` or bare HTML string as a view
var locateView = viewLocator.locateView;
viewLocator.locateView = function(viewOrUrlOrId, area) {
    var viewId;

    // HTML here will be passed into `processMarkup`
    if('string' === typeof viewOrUrlOrId && $.trim(viewOrUrlOrId).charAt(0) === '<') {
        return system.defer(function(dfd) {
            dfd.resolve(viewOrUrlOrId);
        });
    }

    // super()
    return locateView.apply(this, arguments);
};
```

First, we check the `viewOrUrlOrId` parameter to see *if it's both a string **and** starts with a `<`*. If it does, we assume it's actually a view as opposed to a `viewUrl`, and return it as a resolved [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise). If it doesn't, we simply proceed with the normal Durandal functionality, which helps us maintain backwards compatibility.

##### A note on these enhancements

You'll need to include these enhancements before your

app.setRoot()

call, to ensure any calls are intercepted by the new functionality. Otherwise, things may not work as expected

### Sample usage

Now we've got our new functionality in place via our enhancements, let's see a practical example of how to use this new functionality with Durandal, so Webpack can bundle our `Views` and `ViewModels`!

#### ViewModel views

Normally, you wouldn't need to specify the `View` for a particular `ViewModel` instance, as it's inferred by convention by Durandal, depending on the view strategy you've got set up. We'll need to make things more explicit if we want Webpack to bundle our views, however.

We can specify our views as explicit dependencies directly on the ViewModel instances by setting our `getView` method to one which returns our `require`d view HTML:

```js
var jQuery = require('jquery');
var viewEngine = require('durandal/viewEngine');

var ViewModel = {  
    getView: function() {
        var view = require('./view');
        return viewEngine.processMarkup(view);
    }
};
```

Notice we are using the built-in `viewEngine.processMarkup` method here. Durandal expects the output of a `getView` call to be a `DOMElement` instance, so we'll delegate this parsing operation to Durandal since it's already included and handles it nicely.

That's it. Together with our enhancements this is all that's needed to allow both Durandal and Webpack to understand the inter-dependency of our `View` and `ViewModel`. Durandal composes just like before, and Webpack can bundle our view together with our app. Simples!

#### *composition* Binding Handler

The `compose` binding handler can take various forms, as explained in the [Durandal documentation](http://durandaljs.com/documentation/Using-Composition.html). A sample of these is given below

```js
//  Locates the view, realizes it, binds it to the parent binding context and composes it into the DOM node on which the binding is declared.
data-bind="compose: 'myView.html'"

// Uses RequireJS to get the shell module, locates the view conventionally, binds it and injects it into the DOM node on which the binding is declared.
data-bind="compose: 'shell'"

//  Evaluates the binding to obtain the result of someProperty. If it is a string, assume it's a view, otherwise assume it's a viewmodel, and follow the steps above
data-bind="compose: someProperty"
```

Since we're not using Require.js, we'll no longer pass `moduleId`s or `viewUrl`s to the `compose` binding, and will instead always pass a module or HTML instead, respectively. We'll store these as properties on the `ViewModel`, using `require` to retrieve them as static dependencies. For example, amending the previous code sample:

```js
var jQuery = require('jquery');
var viewEngine = require('durandal/viewEngine');

var ViewModel = {  
    myView: require('./myView.html'),
    myViewModel: require('./myViewModel'),

    getView: function() {
            var view = require('./view');
            return viewEngine.processMarkup(view);
    }
};

module.exports = ViewModel;
```

```html
<!-- Composes and binds the View HTML stored in the `myView` property into this view -->  
<div data-bind="compose: myView"></div>

<!-- Composes the ViewModel stored in the `myViewModel` property into this view -->  
<div data-bind="compose: myView"></div>
```

Notice how the dependencies for this `ViewModel` are immediately visible by simply viewing the `viewModel.js` file. This is a helpful by-product of this approach and should help you quickly review the top-level dependency graph of your `ViewModel` without the need to look over your view file.

### Summary

We've implemented some enhancements to the core Durandal `system.acquire` and `viewLocator.locateView` methods which allow us to pass `module` and `view` HTML directly to the `composition` engine. This lets us specify our dependencies directly on the ViewModel, and allows Webpack to understand and bundle the different parts of our application together in an effective way.

For a more hands-on approach, or for those of you who'd simply like to look over the code in action, take a look at the [durandal-webpack](https://github.com/craga89/durandal-webpack) repository and the [online example](https://craga89.github.io/durandal-webpack).

##### Next Chapter (coming soon!): **Durandal and Webpack: Part 3 - Router**
