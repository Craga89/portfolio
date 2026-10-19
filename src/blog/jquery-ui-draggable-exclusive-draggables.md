---
title: ui.draggable.exclusive - Exclusive draggables
date: 2014-07-14
tags: [Plugins, JavaScript, jQuery, jQuery UI]
original: https://blog.craigsworks.com/jquery-ui-draggable-exclusive-draggables/
archived: https://web.archive.org/web/20161103025753/http://blog.craigsworks.com:80/jquery-ui-draggable-exclusive-draggables/
---
*Shout out to to my friend and colleague [Steve Henderson](https://twitter.com/EasyInbox) who came up with the original concept behind this idea!*

#### UI.Draggable(s)... they're not exclusive!

jQuery UI's draggable and droppable component's are great, and are used widely throughout the web to provide consistent, well tested drag/drop functionality across multiple device types. However, one thing that is lacking, is a solid way to make draggable's *exclusive* i.e. **only drop on a single droppable, even if it overlaps multiple droppables!**

As it stands, any draggable which overlaps a droppable that is marked as `active` via the `accept` handler's "truthyness" will have a `drop` event fired if the draggable is released upon it when the drag operation ends. This is problematic if you have say, four closely positioned droppables, only one of which should be dropped upon in a single drag operation.

##### Live demonstration

Drag the `draggable` block below over the numbered `droppables`. You'll notice that it's possible to drop onto multiple `droppables` in a single drag operation.

#### Making them exclusive

*Each `draggable` operation should result in a **single `drop` event**, regardless of the number of droppables the draggable is overlapping*.

So... how do we determine which droppable, out of multiple possible droppables, should be favoured in the drag operation?

##### Determining the user's intent

When a user performs a drag operation, they usually have some sense of which target they are about to drop the draggable on to. We can attempt to discern this using a couple of things...

###### Directionality

Using the *directionality of mouse movement* i.e. which direction the user is moving the draggable, is a great way to guess which `droppable` they intend to drop on. For instance, *if the user is moving in a north-west-erly direction, we can give more **"weight"** to those droppables which lie within the top left of the screen.*

To track this we can store each mouse movement via the `mousemove` event, and use a simple compass baring system to indicate the overall movement of each successive movement.

**Move the mouse around the window above** and *watch the directionality of your movement to tracked via a north/south east/west output* in the top right!

###### Utilising the direction

Once we have a system to discern the user's general mouse direction, *we need a way to utilise this data to **weight each of prospective droppables***, which will let us calculate the most likely target the user meant to drop onto.

To do this, we'll split the draggable into *four* `quadrants`, representing each of the movement directions i.e. north-east, north-west, south-east and south-west. Then, we'' calculate the distance of this `quadrant`'s center to the center of each droppable.

*An example of this is demonstrated below. Drag the `draggable` over multiple `droppables` and watch as the distance is calculated between each of them in real time.*

We do this using a variation of [Pythagorem's theorem](https://en.wikipedia.org/wiki/Pythagorean_theorem), since the two points between the `quadrant` and each `droppable` center forms the hypotenuse of a triangle.

We do this for every droppable on each `mousemove`, which can be quite computationally intensive when we have a large amount of `droppable`s hovered over, but at O(n) complexity it isn't the worst performance bottleneck in the world!

Once we've got a set of distances between all `droppable`s we simply take the `min` of all of them, and use the result as our target droppable. Simple, really!

## Stick it in a plugin!

I've rolled the above ideas into a workable plugin called `ui.draggable.exclusive`, which you can grab via the [official GitHub repository](https://github.com/Craga89/ui.draggable.exclusive). The plugin is a breeze to use; just add the plugin after your jQuery UI script, and add an `exclusive: true` option to your `draggable` options! Done.

Make sure to [check out the documentation](http://craga89.github.io/ui.draggable.exclusive) and feel free you use as you wish, it's **[MIT licensed](https://github.com/Craga89/ui.draggable.exclusive/blob/gh-pages/LICENSE)**!
