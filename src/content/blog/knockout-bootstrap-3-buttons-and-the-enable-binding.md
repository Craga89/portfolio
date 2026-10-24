---
title: Bootstrap 3 Buttons and the enable binding
date: 2014-09-17
tags: [JavaScript, Bootstrap, Knockout.js]
original: https://blog.craigsworks.com/knockout-bootstrap-3-buttons-and-the-enable-binding/
archived: https://web.archive.org/web/20180712085934/http://blog.craigsworks.com:80/knockout-bootstrap-3-buttons-and-the-enable-binding/
---
By default, Knockout's `enable` (and hence `disable` binding, since they share identical but opposite logic) simply set/remove the `disabled` attribute. While this work's great with Bootstrap 3's `<button />`-type elements, it doesn't go so well when using the alternative `<a role='button' />` syntax.

The problem is that Bootsrap expects an additional `disabled` class when disabling `<a/>` elements, which Knockout doesn't add by default. We can remedy this by enhancing the core `enable` binding like so:

```js
/**
Enhanced `enable` binding that adds disabled attribute to .btn elements
to support Bootstrap styling.

NOTE: This also effects the `disable` binding handler, since it simply
      inverts the `enable` bindings logic internally.

@static
@class Enable
@namespace Base.BindingHandlers
**/
var oldEnable = ko.bindingHandlers.enable,
      rIsBtn = /\bbtn\b/;

ko.bindingHandlers.enable = {
    update: function (element, valueAccessor) {
        var result = oldEnable.update.apply(this, arguments),
            enabled = ko.unwrap(valueAccessor());

        // Toggle `disabled` class on all `btn` elements
        if(rIsBtn.test(element.className)) {
            if(enabled) {
                element.className.replace(/\bdisabled\b/gi, '');
            }
            else {
                element.className += ' disabled';
            }
        }

        return result;
    }
};
```

This additional logic will toggle the appropriate `disabled` class on all elements with a `btn` class when bound with the `enable` or `disable` bindingHandler.
