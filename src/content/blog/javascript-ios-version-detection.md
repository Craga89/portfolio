---
title: JavaScript iOS version detection
date: 2012-05-29
tags: [javascript, ios, snippet]
original: https://blog.craigsworks.com/javascript-ios-version-detection
archived: https://web.archive.org/web/20150708113249/http://blog.craigsworks.com:80/javascript-ios-version-detection/
---
Small JavaScript snippet to detect the iOS version in use by the user. **Note that this relys on the user agent always being correctly set, which it isn’t in some cases!**

```js
/*
 * Outputs a float representing the iOS version if user is using an iOS browser i.e. iPhone, iPad
 * Possible values include:
 *	3 - v3.0
 *	4.0 - v4.0
 *	4.14 - v4.1.4
 *	false - Not iOS
 */
 
var iOS = parseFloat(
	('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0,''])[1])
	.replace('undefined', '3_2').replace('_', '.').replace('_', '')
) || false;
```
