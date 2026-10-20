---
title: "Knockout value binding + HTML5 number input"
date: 2014-07-17
tags: [JavaScript, Knockout.js, HTML5]
original: https://blog.craigsworks.com/knockout-value-binding-input-number/
archived: https://web.archive.org/web/20180131164629/http://blog.craigsworks.com:80/knockout-value-binding-input-number/
---
Knockout's default `value` binding is great in most cases, but when using the new HTML5 `<input type="number" />` element, it will always return an empty string when the input is a non-number *i.e. contains anything but 0-9 and a decimal*!

This is actually a byproduct of the `number` type's [WHATWG specification](http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#number-state-%28type=number%29)

> The value sanitization algorithm is as follows: *If the value of the element is not a valid floating-point number, then set it to the empty string instead.*

Luckily, the specification also provides a means of retrieving the input's value as a number, via the `valueAsNumber` property. When a non-numeric string is used, this will return `NaN`.

#### The solution

We can enhance Knockout's `selectExtensions.readValue`, which is utilised by the `value` binding to add support for this feature where possible:

```js
// Add `valueAsNumber` support to `value` bindings etc
ko.selectExtensions.readValue = _.wrap(ko.selectExtensions.readValue, function(read, element) {
    var result = read.apply(this, _.rest(arguments));

    switch(ko.utils.tagNameLower(element)) {
        // For input-type `number` elements, check if it has a `valueAsNumber` property and if so, use it
        case 'input':
            if(element.type === 'number' && 'valueAsNumber' in element) {
                result = element.valueAsNumber;
            }
            break;
    }

    return result;
});
```

**Note:** A byproduct of this implementation is that it will prevent people typing non-numeric characters! There's no easy way around this unfortunately...
