---
title: CKEDITOR key event - modifier keys
date: 2014-07-03
tags: [Plugins, JavaScript, CKEditor]
original: https://blog.craigsworks.com/ckeditor-key-modifiers/
archived: https://web.archive.org/web/20161104142346/http://blog.craigsworks.com:80/ckeditor-key-modifiers/
---
When subscribing to the `key` event on a given `CKEDITOR` instance, the `event.data.keyCode` property will be **the sum of both the associated keyCode and any pressed modifier keyCodes e.g.** ctrl/shift/alt keys as noted on the *[official documentation](http://docs.ckeditor.com/#!/api/CKEDITOR.editor-event-key)*

> - keyCode : Number  
>    *A number representing the key code (or a combination thereof). It is the sum of the current key code and the CKEDITOR.CTRL, CKEDITOR.SHIFT and CKEDITOR.ALT constants, if those are pressed.*

In order to figure out what key as actually pressed *(minus the modifier)* we can use a simple `sanitizeKeyCode` method

```js
/**
 * Takes a CKEDITOR keyCode and returns a sanitized keyCode with any modifiers
 * removed i.e. CKEDITOR.CTRL, CKEDITOR.ALT, CKEDITOR.SHIFT
 * 
 * @param keyCode {Number} CKEDITOR keyCode to check modifier on
 * @return {Number} Sanitized keyCode (minus the modifier keyCodes)
 **/
function sanitizeKeyCode(keyCode) {
  return Math.min(keyCode, 
    Math.max(keyCode - CKEDITOR.CTRL, 0) || keyCode,
    Math.max(keyCode - CKEDITOR.SHIFT, 0) || keyCode,
    Math.max(keyCode - CKEDITOR.ALT, 0) || keyCode
  );
}

/**
 * Determines if a given modifier key is present in CKEDITOR keyCode
 * 
 * @example
 *  // CTRL=1114112, ALT=4456448, SHIFT=2228224
 *  isModifier(2228261, CKEDITOR.SHIFT); // True (SHIFT+leftKey)
 *  isModifier(1114177, CKEDITOR.CTRL); // True (CTRL+a)
 * 
 * @param keyCode {Number} CKEDITOR keyCode to check modifier on
 * @param modifier {Number} CKEDITOR.CTRL, CKEDITOR.ALT or CKEDITOR.SHIFT
 * @return {Boolean} True if given modifier was present in given keyCode
 **/
function isModifier(keyCode, modifier) {
  return Math.min(keyCode, Math.max(keyCode - modifier) || keyCode) !== keyCode;
}
```

Also included is a handy `isModifier` method that takes a `keyCode` and a `modifierCode`, and rrturns true **if the keyCode is a sum of another key and that given modifier.**
