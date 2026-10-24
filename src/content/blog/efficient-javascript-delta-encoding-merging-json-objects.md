---
title: "Efficient JavaScript Delta-encoding – Merging JSON objects"
date: 2012-04-24
tags: [JavaScript, Old, Delta Encoding]
original: https://blog.craigsworks.com/efficient-javascript-delta-encoding-merging-json-objects/
archived: https://web.archive.org/web/20170630123519/http://blog.craigsworks.com/efficient-javascript-delta-encoding-merging-json-objects/
---
## NOTE

**This is a very old blog post and I would not recommend using it in production. Utilising the Function consutrctor in this way, whilst useful, opens up issues of security and XSS issues. Also, there are much better ways of doing this, especially relating to the re-usage of objects (object pooling), [discussed here](http://buildnewgames.com/garbage-collector-friendly-code/).**

### Preface

As I’m now in my 3rd year at Newcastle University, I was expected to produce a 40-page thesis over the last few months on a subject of my choice: *2D Multiplayer game using browser-native HTML5 standards and the Node.js run-time.*

I decided early on to use the Client-Server architecture after reading up on several articles, particularly Glenn Fiedler’s “What every programmer needs to know about game networking” and Valve’s awesome multiplayer networking overview. However this meant a lot of extra work would be needed to make it playable, including the topic of this post: Delta-encoding.

### Delta Encoding?

Delta encoding is a way of storing or transmitting data in the form of differences between sequential data rather than complete files.

That is, instead of sending a full game state to every client, we send only the differences between the new and last state, which gives us considerable bandwidth savings.

How do you implement something like this efficiently in JavaScript? It has no native method for merging objects, and using loops just doesn’t cut it performance-wise, at least cross-browser. Thankfully though, since the objects we’ll be merging have a pre-determined number of properties, we can avoid looping on each merge and take a shortcut.

### Implementation

Here’s the full code listing for you to digest before I go into the details of how it works:

```js
var Entity = function(params) {
	this.merge(Entity.defaults);
	this.merge(params);
};

Entity.defaults = {
	position: [0, 0],
	velocity: [0, 0],
	acceleration: [1, 1]
};

Entity.merge = function(obj1, obj2) {
	var cons = obj1.constructor,
		func = obj1._mergeFunc, props, p, i;

	// Create the merge function if one isn't already defined
	if(!func) {
		func = '';

		// Loop over the first objects default properties and create our merge function
		if((props = cons.defaults)) {
			for(p in props) {
				func += 'if(typeof obj2.'+p+' !== "undefined") {' +
					'obj.'+p+' = obj2.'+p+';' +
				'} ';
			}
		}

		// Create and store the new function
		func = cons._mergeFunc = new Function('obj', 'obj2', func);
	}

	// Run the merge function and return the first object
	return func(obj1, obj2), obj1;
};

Entity.prototype.merge = function(obj) {
	return obj ? Entity.merge(this, obj) : false;
}
```

#### Important notes:

1. This will only merge properties defined in the Entity.defaults object.
2. Variables passed by reference i.e. Objects and Arrays, are not copied but simply set by reference.

   - ergo... any Arrays or Objects which are merged into the first object are references to those in the second, so any changes will appear in both as it is the same object.
3. *This method should only be used when you intend to discard the object that is to be merged i.e. the second object, which is the case in merging delta state objects.*

The general idea behind the code is simple: Rather than using a loop to iterate over the second objects properties and merge them in upon each call to the merge function, we take advantage of the [Function constructor](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function), which allows us to compile functions dynamically. This dynamically created function does the following when executed:

1. For every property in the obj1‘s constructor property (Entity.defaults):
2. Check if the property within the defaults object is also defined in the second object.
3. If it is, set the first objects property value to that of the second object.

[Check out the jsPerf results](http://jsperf.com/json-object-merge/11) that compare the usual iterative loop method with the above cached merge method. We can see a pretty tremendous increase in cross-browser ops/second using this approach, staggeringly so in Chrome and it’s open-source counterpart, making handling multiple merges between several objects a breeze.

So there you have it, an efficient way to merge objects with pre-determined properties for use in Delta-encoding.
