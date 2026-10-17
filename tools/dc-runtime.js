/*
 * dc-runtime: a small standalone runtime for the craigthompson.dev design files.
 *
 * It renders a <template> written in the design-canvas dialect:
 *   {{path}} holes in text and attributes, onClick/onChange/onKeyDown="{{fn}}",
 *   <sc-for list="{{items}}" as="x"> and <sc-if value="{{flag}}">,
 * driven by a `class Component extends DCLogic { renderVals() { ... } }` script,
 * with setState(), props and componentDidMount/Update/WillUnmount.
 *
 * Re-renders are patched into the live DOM (not replaced), so focus, <details>
 * state and canvases survive, and server-prerendered markup is reused.
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONE_HOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var EVENTS = { onclick: 'click', onchange: 'input', onkeydown: 'keydown', oninput: 'input' };

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  function str(v) { return v == null || v === false ? '' : String(v); }

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, next);
    if (this.__app) this.__app.schedule();
  };

  function App(root, template, Component, props) {
    this.root = root;
    this.template = template;
    this.fns = [];
    this.pending = false;
    this.mounted = false;
    this.c = new Component(props);
    this.c.props = props;
    if (!this.c.state) this.c.state = {};
    this.c.__app = this;
    this.bindEvents();
  }

  App.prototype.schedule = function () {
    if (this.pending || !this.mounted) return;
    this.pending = true;
    var self = this;
    var run = function () { self.pending = false; self.render(); };
    // State set while mounting re-renders in its own task, so the first paint-ready work and
    // that follow-up render don't add up to one long task.
    if (this.mounting) setTimeout(run, 0); else Promise.resolve().then(run);
  };

  App.prototype.bindEvents = function () {
    var self = this;
    Object.keys(EVENTS).forEach(function (attr) {
      var type = EVENTS[attr];
      if (self['_b' + type]) return;
      self['_b' + type] = true;
      self.root.addEventListener(type, function (e) {
        var n = e.target;
        while (n && n !== self.root) {
          if (n.getAttribute) {
            var id = n.getAttribute('data-dc-' + type);
            if (id != null && self.fns[+id]) {
              self.fns[+id].call(self.c, e);
              if (e.cancelBubble) break;
            }
          }
          n = n.parentNode;
        }
      });
    });
  };

  // Build a fresh DOM fragment from the template for the current values.
  App.prototype.build = function (vals) {
    var self = this;
    self.fns = [];
    var frag = document.createDocumentFragment();

    function walk(src, out, scope) {
      for (var node = src.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 3) {
          var t = node.data;
          t = t.indexOf('{{') < 0 ? t : t.replace(HOLE, function (_, p) { return str(lookup(scope, p)); });
          // Match what the HTML parser makes of prerendered markup: no empty text nodes, and
          // neighbouring text in one node. Otherwise hydration rewrites hundreds of nodes.
          var prev = out.lastChild;
          if (prev && prev.nodeType === 3) prev.data += t;
          else if (t) out.appendChild(document.createTextNode(t));
        } else if (node.nodeType === 1) {
          var tag = node.localName;
          if (tag === 'sc-for') {
            var m = ONE_HOLE.exec(node.getAttribute('list') || '');
            var list = m ? lookup(scope, m[1]) : null;
            var as = node.getAttribute('as') || 'item';
            if (list && list.length) {
              for (var i = 0; i < list.length; i++) {
                var s = Object.create(scope);
                s[as] = list[i];
                walk(node, out, s);
              }
            }
          } else if (tag === 'sc-if') {
            var mv = ONE_HOLE.exec(node.getAttribute('value') || '');
            if (mv && lookup(scope, mv[1])) walk(node, out, scope);
          } else {
            var el = node.cloneNode(false);
            var attrs = Array.prototype.slice.call(el.attributes);
            for (var a = 0; a < attrs.length; a++) {
              var name = attrs[a].name, val = attrs[a].value;
              if (name.indexOf('hint-placeholder') === 0) { el.removeAttribute(name); continue; }
              if (val.indexOf('{{') < 0) continue;
              var lower = name.toLowerCase();
              if (EVENTS[lower]) {
                el.removeAttribute(name);
                var fm = ONE_HOLE.exec(val);
                var fn = fm ? lookup(scope, fm[1]) : null;
                if (typeof fn === 'function') {
                  self.fns.push(fn);
                  el.setAttribute('data-dc-' + EVENTS[lower], String(self.fns.length - 1));
                }
                continue;
              }
              var one = ONE_HOLE.exec(val);
              var out2 = one ? lookup(scope, one[1]) : val.replace(HOLE, function (_, p) { return str(lookup(scope, p)); });
              if (out2 == null || out2 === false) el.removeAttribute(name);
              else el.setAttribute(name, out2 === true ? '' : String(out2));
            }
            walk(node.content || node, el, scope);
            out.appendChild(el);
          }
        }
      }
    }
    walk(this.template.content, frag, vals);
    return frag;
  };

  // ---- patching ----
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    return a.localName === b.localName && (a.id || '') === (b.id || '');
  }

  function syncAttrs(a, b) {
    if (a.localName === 'canvas') return; // owned by effects code
    var i, n;
    var bs = b.attributes;
    for (i = 0; i < bs.length; i++) {
      n = bs[i].name;
      if (a.getAttribute(n) !== bs[i].value) a.setAttribute(n, bs[i].value);
    }
    var as = Array.prototype.slice.call(a.attributes);
    for (i = 0; i < as.length; i++) {
      n = as[i].name;
      if (b.hasAttribute(n)) continue;
      if (n === 'open' && (a.localName === 'details' || a.localName === 'dialog')) continue; // user-toggled, or opened with showModal()
      if (n === 'tabindex' && a.getAttribute(n) === '-1') continue; // set by code to move focus to a section
      a.removeAttribute(n);
    }
    if ((a.localName === 'input' || a.localName === 'textarea') && document.activeElement !== a) {
      var v = b.getAttribute('value') || '';
      if (a.value !== v) a.value = v;
    }
  }

  function patchChildren(oldEl, newEl) {
    var o = oldEl.firstChild;
    var n = newEl.firstChild;
    while (n) {
      var next = n.nextSibling;
      var found = null, c = o, k = 0;
      while (c && k < 8) {
        if (sameNode(c, n)) { found = c; break; }
        c = c.nextSibling; k++;
      }
      if (found) {
        while (o !== found) { var r = o; o = o.nextSibling; oldEl.removeChild(r); }
        patchNode(found, n);
        o = found.nextSibling;
      } else {
        oldEl.insertBefore(n, o);
      }
      n = next;
    }
    while (o) { var rm = o; o = o.nextSibling; oldEl.removeChild(rm); }
  }

  function patchNode(a, b) {
    if (a.nodeType === 3 || a.nodeType === 8) {
      if (a.data !== b.data) a.data = b.data;
      return;
    }
    syncAttrs(a, b);
    if (a.localName === 'canvas') return;
    patchChildren(a, b);
  }

  App.prototype.render = function () {
    var c = this.c;
    var vals = c.renderVals ? c.renderVals() : {};
    var frag = this.build(vals || {});
    var holder = document.createElement('div');
    holder.appendChild(frag);
    patchChildren(this.root, holder);
    if (!this.mounted) {
      this.mounted = true;
      this.mounting = true;
      try { if (c.componentDidMount) c.componentDidMount(); } finally { this.mounting = false; }
    } else if (c.componentDidUpdate) {
      c.componentDidUpdate();
    }
  };

  function readProps(script) {
    var props = {};
    try {
      var spec = JSON.parse(script.getAttribute('data-props') || '{}');
      Object.keys(spec).forEach(function (k) {
        if (k.charAt(0) === '$') return;
        if (spec[k] && typeof spec[k] === 'object' && 'default' in spec[k]) props[k] = spec[k].default;
      });
    } catch (e) {}
    return props;
  }

  function mount(opts) {
    var root = document.querySelector(opts.root);
    var template = document.querySelector(opts.template);
    var script = document.querySelector(opts.script);
    var Component = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    var props = Object.assign(readProps(script), opts.props || {});
    var app = new App(root, template, Component, props);
    app.render();
    window.addEventListener('pagehide', function () {
      if (app.c.componentWillUnmount) try { app.c.componentWillUnmount(); } catch (e) {}
    });
    return app;
  }

  window.DCRuntime = { mount: mount, DCLogic: DCLogic };
})();
