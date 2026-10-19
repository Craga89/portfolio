---
title: Tether.js - Transition small movements
date: 2015-09-01
tags: []
original: https://blog.craigsworks.com/tether-js-transition-small-changes/
archived: https://web.archive.org/web/20180628012734/http://blog.craigsworks.com/tether-js-transition-small-changes/
---
I've been using [Tether.js](http://github.hubspot.com/tether/) recently, which is a great little utility library for dynamically positioning your elements in relation to other elements on the page (similar to the jQuery UI [Position plugin](https://api.jqueryui.com/position/)).

I've recently added some additional `module` code, which lets you use CSS3 transitions to animate small movements of the offset nicely, leaving bigger changes to happen instantly.

```js
var transitionModule = {
	className: 'transition',
	thresholdX: 50,
	thresholdY: 50,

	position: function(props) {
		var className = this.options.classPrefix + '-' + transitionModule.className,
			hasClass = Tether.Utils.hasClass(this.element, className),
			lastOffset = this._cacheOffset;

		var shouldAddClass = lastOffset &&
			Math.abs(props.left - lastOffset[0]) <= transitionModule.thresholdX &&
			Math.abs(props.top - lastOffset[1]) <= transitionModule.thresholdY;

		if(!hasClass && shouldAddClass) {
			Tether.Utils.addClass(this.element, className);
		}
		else if(hasClass && !shouldAddClass) {
			Tether.Utils.removeClass(this.element, className);
		}

		// Cache the offset
		this._cacheOffset = [props.left, props.top];
	}
};

Tether.modules.push(transitionModule);
```

**Note: Include this before any .tether() calls, otherwise the classes won't be applied until the next call!**

By default, any change in offset that is *less than 50px* in either direction will automatically apply a `tether-transition` class, which I've got set up to apply some nice transform transitions, like so:

```css
.tether.tether-transition {
	transition: -webkit-transform 100ms ease-in-out;
	transition: transform 100ms ease-in-out;
}
```

Wala! Buttery smooth transitions for your less-than-50px-in-any-direction updates!
