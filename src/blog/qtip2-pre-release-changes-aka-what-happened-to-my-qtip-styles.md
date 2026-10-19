---
title: "qTip2 - Pre-release changes (AKA What happened to my qTip styles!?)"
date: 2012-11-20
tags: [plugins, javascript]
original: https://blog.craigsworks.com/qtip2-pre-release-changes-aka-what-happened-to-my-qtip-styles
archived: https://web.archive.org/web/20150320043320/http://blog.craigsworks.com/qtip2-pre-release-changes-aka-what-happened-to-my-qtip-styles/
---
qTip2 is under-going to considerable changes over the next few weeks, with a new website on it’s way, a brand new build system to go along with it, and several new features and documentation updates. However, there are some breaking changes as qTip2 marches on to it’s final `2.0` release, and firmly out of nightly status!

As many of you watching GitHub repository will know, the class\_rename branch, which removes dependency upon the `ui-tooltip\*` classes used by jQuery UI, has been merged back in the master branch. This means of course, that any of you relying on the old class structure in your code, need to update to the new classes names.

A list of old and new class names is listed below to ease this!

- #ui-tooltip-<id> → #qtip-<id>
- **.**ui-tooltip → **.**qtip
- **.**ui-tooltip-content → **.**qtip-content
- **.**ui-tooltip-titlebar → **.**qtip-titlebar
- **.**ui-tooltip-title → **.**qtip-title
- **.**ui-tooltip-button → **.**qtip-close
- **.**ui-tooltip-icon → **.**qtip-icon
- **.**ui-tooltip-focus → **.**qtip-focus
- **.**ui-tooltip-hover → **.**qtip-hover
- **.**ui-tooltip-default → **.**qtip-default

As you can see, the `ui-tooltip-` prefix has simply been replace with the `qtip-` prefix. This applies to every in-built and CSS3 style too (in `basic.css` and `css3.css` respectively).

A full list of changes is forth-coming, but for now this is the only breaking change you’re likely to encounter. Let me know via the issue tracker if you notice any more!
