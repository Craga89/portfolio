---
title: Generating Roman Numerals
date: 2015-12-02
tags: [JavaScript]
original: https://blog.craigsworks.com/generating-roman-numerals/
archived: https://web.archive.org/web/20180628012730/http://blog.craigsworks.com/generating-roman-numerals/
---
We've been conducting pair programming exercises at work using the excellent [FreeCodeCamp](http://www.freecodecamp.com/), and came upon an interesting problem to solve using JavaScript. We needed to create a generic function for generating [Roman Numeral](https://en.wikipedia.org/wiki/Roman_numerals) equivalent for any number within a reasonable range (say, to 10000). This is what we came up with!

```js
var numeralsMap = {
	1: 'I',
	5: 'V',
	10: 'X',
	50: 'L',
	100: 'C',
	500: 'D',
	1000: 'M',
	5000: 'V`',
	10000: 'X`',
	50000: 'L`',
	100000: 'C`',
	500000: 'D`',
	1000000: 'M`'
};

// Retrieves the most significant number of a given number
// i.e. the left-hand most number: 5474 -> 5, 4111 -> 4 etc.
function mostSignificantNumber(num) {
	return Number(String(num).charAt(0));
}

// Generates the Roman Numeral for a given one, tens, hundreds
// etc. number. padded by zeroes that signify it's column
function partialRomanNumeral(num) {
	var letter = numeralsMap[num];
	if (letter) {
		return letter;
	}

	var places = String(num).length;
	var multiplier = Math.pow(10, places - 1);
	var low = 1 * multiplier;
	var mid = (5 - 1) * multiplier;
	var high = (10 - 1) * multiplier;
	var repeat;

	// I -> III
	if (num < mid) {
		repeat = mostSignificantNumber(num);
		return numeralsMap[low].repeat(repeat);
	}
	// IV
	else if (num === mid) {
		return numeralsMap[low] + numeralsMap[mid + low];
	}
	// V -> VIII
	else if(num < high) {
		repeat = mostSignificantNumber(num - (mid + multiplier));
		return numeralsMap[mid + low] + numeralsMap[low].repeat(repeat);
	}
	// IX
	else {
		return numeralsMap[low] + numeralsMap[high + low];
	}
}

// Generates the Roman numeral for any given number by splitting it
// into individual ones, tens, hundreds etc. numbers, and combining
// each individual columns Roman Numeral right-to-left.
//
// romanNumeral(51) -> partialRomanNumeral(1) + partialRomanNumeral(50)
//
function romanNumeral(num) {
	if (num > 1000000) {
		throw new Error('Number too large');
	}

	return Array.prototype.reduce.call(String(num), function(memo, n, i) {
		var power = Math.pow(10, i + 1);
		var numeral = num % power - num % (power / 10);

		return partialRomanNumeral(numeral) + memo;
	},
	'');
}
```

You can use it like so:

```js
romanNumeral(5) // "V"
romanNumeral(9) // "IX"
romanNumeral(46) // "XL"
romanNumeral(2015) // "MMXV"
```

Enjoy!
