---
title: jQuery UI Draggable - Droppables in an iFrame
date: 2014-01-02
tags: [Plugins, JavaScript, jQuery, jQuery UI]
original: https://blog.craigsworks.com/jquery-ui-draggable-droppables-in-an-iframe
archived: https://web.archive.org/web/20180708060346/http://blog.craigsworks.com:80/jquery-ui-draggable-droppables-in-an-iframe/
---
You've got the usual drag and drop use case, but you want to have your draggables in the top window, and the droppables within an iframe (located on [the same domain](http://stackoverflow.com/questions/3076414/ways-to-circumvent-the-same-origin-policy), ofcourse!).

jQuery UI doesn't support this use case, and as such the offset of the container frame element isn't taken into account, causing issues with drop detection!

## The warning

This fix requires the *overriding of a core jQuery UI* method, but **should not be done in the main `jquery-ui.js` file!**. Instead, include this in a new file, and *include it **after** the jQuery UI library script*. Obviously if jQuery UI's method changes substantially, or disappears entirely, this fix won't work. But until then... happy dragging!

## The fix (jQuery UI v1.8+)

The fix is fairly straight forward, but requires overriding the `$.ui.ddmanager.prepareOffsets` method, in order to take into account elements which lie within a different document/frame. Here's the code:

```js
// Create new object to cache iframe offsets
$.ui.ddmanager.frameOffsets = {};
 
// Override the native `prepareOffsets` method. This is almost
// identical to the un-edited method, except for the last part!
$.ui.ddmanager.prepareOffsets = function (t, event) {
    var i, j,
        m = $.ui.ddmanager.droppables[t.options.scope] || [],
        type = event ? event.type : null, // workaround for #2317
        list = (t.currentItem || t.element).find(":data(ui-droppable)").addBack(),
        doc, frameOffset;
 
    droppablesLoop: for (i = 0; i < m.length; i++) {
 
        //No disabled and non-accepted
        if (m[i].options.disabled || (t && !m[i].accept.call(m[i].element[0], (t.currentItem || t.element)))) {
            continue;
        }
 
        // Filter out elements in the current dragoged item
        for (j = 0; j < list.length; j++) {
            if (list[j] === m[i].element[0]) {
                m[i].proportions().height = 0;
                continue droppablesLoop;
            }
        }
 
        m[i].visible = m[i].element.css("display") !== "none";
        if (!m[i].visible) {
            continue;
        }
 
        //Activate the droppable if used directly from draggables
        if (type === "mousedown") {
            m[i]._activate.call(m[i], event);
        }
        
        // Re-calculate offset
        m[i].offset = m[i].element.offset();

        // Re-calculate proportions (jQuery UI ~1.10 introduced a `proportions` cache method, so support both here!)
        proportions = { width: m[i].element[0].offsetWidth, height: m[i].element[0].offsetHeight };
        typeof m[i].proportions === 'function' ? m[i].proportions(proportions) : (m[i].proportions = proportions);
        
        /* ============ Here comes the fun bit! =============== */
 
        // If the element is within an another document...
        if ((doc = m[i].document[0]) !== document) {
            // Determine in the frame offset using cached offset (if already calculated)
            frameOffset = $.ui.ddmanager.frameOffsets[doc];
            if (!frameOffset) {
                // Calculate and cache the offset in our new `$.ui.ddmanager.frameOffsets` object
                frameOffset = $.ui.ddmanager.frameOffsets[doc] = $(
                    // Different browsers store it on different properties (IE...)
                    (doc.defaultView || doc.parentWindow).frameElement
                ).offset();
            }
 
            // Add the frame offset to the calculated offset
            m[i].offset.left += frameOffset.left;
            m[i].offset.top += frameOffset.top;
        }
    }
};
```

## The explanation

In order for the droppable offets to be calculated correctly, the offset of the *containing frame* must be taken into account, by adding it to the calculated droppables `top` and `left` offsets. This ensures the offset is correct in relation to the parent document.

**Important note:** The `$.ui.ddmanager.frameOffsets` object caches the `<iframe>` offset in `.prepareOffsets()`. If this changes regularly, you may need to prevent caching this and instead re-evaluate the `.offset()` call on the `frameElement` each time the `.prepareOffsets()` method is run.
