---
title: "qTip2 – Tip plugin’s dimension options updated"
date: 2012-08-26
tags: [Plugins, JavaScript]
original: https://blog.craigsworks.com/qtip2-tips-plugins-dimension-options-changed/
archived: https://web.archive.org/web/20180531233402/http://blog.craigsworks.com:80/qtip2-tips-plugins-dimension-options-changed/
---
For those of you using the qTip2 [nightly builds](http://qtip2.com/nightly), as of commit [970cfabacd](https://github.com/Craga89/qTip2/commit/970cfabacd0511feb516eb3b632f6cc2bfa337e2) the tip plugin’s `width` and `height` options have changed slightly to become relative to the tips position on the tooltip.

## "relative to the tips position"?!

When the position of the tip is on the horizontal sides of the tooltip i.e. the left or right, the width and height are switched. This is done to ensure the tip dimensions stay as you’d expect no matter what position the actual tooltip is in.

To demonstrate this, see the jsFiddle example below of the past and current implementations.
