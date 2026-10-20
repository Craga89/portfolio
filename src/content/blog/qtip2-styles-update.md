---
title: qTip2 - Styles update
date: 2012-05-13
tags: [plugins, javascript]
original: https://blog.craigsworks.com/qtip2-styles-update/
archived: https://web.archive.org/web/20150320043254/http://blog.craigsworks.com/qtip2-styles-update/
---
In the [recent commit today](https://github.com/Craga89/qTip2/commit/563329f7198708c7c4d4ab28b41d4c6642275796) a re-factoring of the CSS stylesheets took place in order to simply the styles qTip2 uses, as well as changes to the underlying tips code to cope with these changes.

1. The biggest change is the movement of the `border` and `border-radius` declarations from the *titlebar and content elements* to the main `ui-tooltip` element. Thanks to this, many duplicate styles could be **removed from the stylesheet for a *10% size saving!***

   - This will likely effect the styling of your tooltips upon updating, and you may see black borders on your tooltip “tips” until you move the border colour declarations to the top ui-tooltip element.
2. The `ui-tooltip-shadow` class now *only works in IE9+ now* because of this modification and removal of the IE9> `filter` declarations. This was done because applying a filter to any element renders the overflow property useless, as reference from this [blog post comment](http://labs.thesedays.com/blog/2011/06/02/ie-alpha-overflow-hidden-bug/#comment-291):

   What I think happens in IE<9 is it “designates” a square where DirectX can render on top of a hasLayout box based on `width`+`height` properties, and if content tries to expand outside that box then it’ll be cut off. I think that in block elements which have filters in them that everything in them is also rendered by DirectX. (As a side effect which you may already be aware of, text rendered by DirectX wasn’t ClearType aware and so in particular bolded text rendered garbled in IE6, leading to the devs to turn off ClearType entirely in filtered elements in IE7-8.)

   It sucks, but if you want native shadows in IE you’re going to need to do some hacking! Sorry guys!

Thanks to [Tanguy Krotoff](https://github.com/tkrotoff) for the motivation and bug reports behind this!
