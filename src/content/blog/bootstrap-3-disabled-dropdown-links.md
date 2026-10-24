---
title: Bootstrap 3 - Disabled dropdown links
date: 2014-06-02
tags: [JavaScript, CSS, Bootstrap, LESS]
original: https://blog.craigsworks.com/bootstrap-3-disabled-dropdown-links/
archived: https://web.archive.org/web/20180712090533/http://blog.craigsworks.com:80/bootstrap-3-disabled-dropdown-links/
---
Bootstrap 3 has built-in visual support for disabled dropdown menu items as seen from their `dropdowns.less` file:

```less
.dropdown-menu > .disabled > a {
  &,
  &:hover,
  &:focus {
    color: @dropdown-link-disabled-color;
  }
}
// Nuke hover/focus effects
.dropdown-menu > .disabled > a {
  &:hover,
  &:focus {
    text-decoration: none;
    background-color: transparent;
    background-image: none; // Remove CSS gradient
    .reset-filter();
    cursor: not-allowed;
  }
}
```

However, these are simply visual changes and don't actually impact the *interactivity* of the element itself, meaning **it will still be clickable**!

We can get around this by utilising a combination of the `[disabled]` attribute (for oldIE support), and the CSS `pointer-events: none` rule (for evergreen browsers), a technique [outlined on StackOverflow](http://stackoverflow.com/questions/10276133/how-to-disable-html-links). Here's the CSS (or LESS, SASS etc.):

```css
/**
Bootstrap 3 - Disabled dropdown links

Bootstrap 3 has built-in visual support for disabled dropdown menu items, however these are simply 
visual changes and don't actually impact the interactivity of the element itself.

Once this is added to your styles, you can easily disable any dropdown item by applying a [disabled] attribute 
to the <a/> element itself, and adding the usual .disabled class to the parent <li>.

More information here: http://blog.craigsworks.com/bootstrap-3-disabled-dropdown-links/
**/

/*
Mimic cursor style from native .dropdown-menu > .disabled > a{} styles,
since `pointer-events: none` kills the cursor state, too. 
*/
.dropdown-menu > .disabled{
 cursor: not-allowed; 
}

/* The real magic ;) */
.dropdown-menu > .disabled > a{
 pointer-events: none;
}
```

Once added to your styles, you can easily disable any dropdown item by applying a `[disabled]` attribute to the `<a/>` element itself, and adding the usual `.disabled` class to the parent `<li>`, as seen below.

```html
<ul class="dropdown-menu">  
 <li class="disbled"> <!-- Disabled class here -->
  <a disabled>Item 1</a> <!-- Disabled attribute here -->
 </li>
</ul>
```

And that's it! Your links will be **truly unclickable**. This will work on all evergreen browsers, as well as IE6+, though *may have limited support for older versions of Opera*. For more information, see the [StackOverflow post](http://stackoverflow.com/a/10276157).
