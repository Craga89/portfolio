---
title: var, commas and equals
date: 2012-08-12
tags: [javascript]
original: https://blog.craigsworks.com/var-commas-and-equals/
archived: https://web.archive.org/web/20150319223043/http://blog.craigsworks.com/var-commas-and-equals/
---
Working with JavaScript for a while (or any other language for that matter) you tend to pick up on a lot of nuances particular to the language, but even long time users get tripped up every now and again, as did I with a recent namespace issue involving… you guessed it: var, *commas* and **equals**!

Take for example this:

[See the code on GitHub](https://gist.github.com/undefined)

At first glance, it might seem as if *both* `foo` and `bar` variables should be declared within the local invoke methods scope, but this alas is not the case, and for good reason!

Since **statements are evaluated right to left**, it first attempts to set the bar variable to “uhoh”, and since no bar variable is defined in our local scope (yet), it travels up the scope chain checking for a defined foo variable, until it gets to the window object, (or possibly some other scope if this is embedded within other methods&hrllip;), and sets foo as a property of that scope… *we’ve just polluted the global namespace!*

Perhaps not what you’d expect upon first glance, and an easy thing to get tripped up on. The solution is simple,and actually a little syntactically nicer (i.e. more explicit) in my opinion:

[See the code on GitHub](https://gist.github.com/undefined)
