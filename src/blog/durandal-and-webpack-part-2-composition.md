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

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

We'll override this method to allow the `moduleId` to be either a **`String` or a `Function`**. In the latter case, this function is given a single argument, another function we'll call `cb`, which takes the following form:

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

The `cb` function should be called with `null` as the first argument if no error occurred, and the resolved `module` as the second parameter. This may look familiar to you if you've used Node extensively, as it's the [standard Node.js callback pattern](http://fredkschott.com/post/2014/03/understanding-error-first-callbacks-in-node-js/).

With this in mind, let's take a look at the override in full:

[See the code on GitHub](https://gist.github.com/1334186a7973b483d3c7)

This may look complex, but basically all it's allowing you to do is specify `moduleId` as a `Function`, which can either return the `module` directly, or execute a passed callback when you've retrieved it asynchronously (more on why we want this later!).

### viewLocator.locateView

The logic for this method is a little more complex, but we're only interested in the first parameter:

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

We'll need to override this method to allow the `viewOrUrlOrId` to be a bare HTML string (a `String` whose first character is a `<`).

[See the code on GitHub](https://gist.github.com/1334186a7973b483d3c7)

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

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

Notice we are using the built-in `viewEngine.processMarkup` method here. Durandal expects the output of a `getView` call to be a `DOMElement` instance, so we'll delegate this parsing operation to Durandal since it's already included and handles it nicely.

That's it. Together with our enhancements this is all that's needed to allow both Durandal and Webpack to understand the inter-dependency of our `View` and `ViewModel`. Durandal composes just like before, and Webpack can bundle our view together with our app. Simples!

#### *composition* Binding Handler

The `compose` binding handler can take various forms, as explained in the [Durandal documentation](http://durandaljs.com/documentation/Using-Composition.html). A sample of these is given below

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

Since we're not using Require.js, we'll no longer pass `moduleId`s or `viewUrl`s to the `compose` binding, and will instead always pass a module or HTML instead, respectively. We'll store these as properties on the `ViewModel`, using `require` to retrieve them as static dependencies. For example, amending the previous code sample:

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

[See the code on GitHub](https://gist.github.com/add43ae8b5f245b29ec7)

Notice how the dependencies for this `ViewModel` are immediately visible by simply viewing the `viewModel.js` file. This is a helpful by-product of this approach and should help you quickly review the top-level dependency graph of your `ViewModel` without the need to look over your view file.

### Summary

We've implemented some enhancements to the core Durandal `system.acquire` and `viewLocator.locateView` methods which allow us to pass `module` and `view` HTML directly to the `composition` engine. This lets us specify our dependencies directly on the ViewModel, and allows Webpack to understand and bundle the different parts of our application together in an effective way.

For a more hands-on approach, or for those of you who'd simply like to look over the code in action, take a look at the [durandal-webpack](https://github.com/craga89/durandal-webpack) repository and the [online example](https://craga89.github.io/durandal-webpack).

##### Next Chapter (coming soon!): **Durandal and Webpack: Part 3 - Router**
