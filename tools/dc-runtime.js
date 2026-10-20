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
(() => {
  'use strict';

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONE_HOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  /** Template attribute → DOM event it binds. */
  const EVENTS = /** @type {Record<string, string>} */ ({ onclick: 'click', onchange: 'input', onkeydown: 'keydown', oninput: 'input' });

  /** @typedef {Record<string, any>} Scope */
  /** @typedef {(this: DCLogic, e: Event) => void} Handler */

  /**
   * A dotted path ("a.b.c") in the render values; "true" and "false" are literals.
   * @param {Scope} scope
   * @param {string} path
   * @returns {unknown}
   */
  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    /** @type {any} */
    let v = scope;
    for (const part of path.split('.')) {
      if (v == null) return undefined;
      v = v[part];
    }
    return v;
  }

  /** @param {unknown} v */
  const str = (v) => (v == null || v === false ? '' : String(v));

  /** The base class design-file components extend. */
  class DCLogic {
    /** @param {Record<string, unknown>} [props] */
    constructor(props) {
      /** @type {Record<string, any>} */
      this.props = props || {};
      /** @type {Record<string, any>} */
      this.state = {};
      /** @type {App | undefined} */
      this.__app = undefined;
    }

    /** @param {Record<string, any> | ((state: Record<string, any>, props: Record<string, any>) => Record<string, any>)} patch */
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, next);
      if (this.__app) this.__app.schedule();
    }
  }

  /**
   * @typedef {DCLogic & {
   *   renderVals?: () => Scope,
   *   componentDidMount?: () => void,
   *   componentDidUpdate?: () => void,
   *   componentWillUnmount?: () => void,
   * }} Component
   */

  class App {
    /**
     * @param {HTMLElement} root
     * @param {HTMLTemplateElement} template
     * @param {new (props: Record<string, unknown>) => Component} ComponentClass
     * @param {Record<string, unknown>} props
     */
    constructor(root, template, ComponentClass, props) {
      this.root = root;
      this.template = template;
      /** @type {Handler[]} */
      this.fns = [];
      this.pending = false;
      this.mounted = false;
      this.mounting = false;
      /** An optional step between building and patching (the page translator uses it). @type {((holder: HTMLElement) => void) | null} */
      this.transform = null;
      /** The previous render, for comparing with the next one. @type {Node | null} */
      this.prev = null;
      /** @type {Set<string>} */
      this.bound = new Set();
      this.c = new ComponentClass(props);
      this.c.props = props;
      if (!this.c.state) this.c.state = {};
      this.c.__app = this;
      this.bindEvents();
    }

    schedule() {
      if (this.pending || !this.mounted) return;
      this.pending = true;
      const run = () => {
        this.pending = false;
        this.render();
      };
      // State set while mounting re-renders in its own task, so the first paint-ready work and
      // that follow-up render don't add up to one long task.
      if (this.mounting) setTimeout(run, 0);
      else Promise.resolve().then(run);
    }

    /** One delegated listener per event type, dispatching to the handler ids on the elements. */
    bindEvents() {
      for (const type of new Set(Object.values(EVENTS))) {
        if (this.bound.has(type)) continue;
        this.bound.add(type);
        this.root.addEventListener(type, (e) => {
          for (let n = /** @type {Node | null} */ (e.target); n && n !== this.root; n = n.parentNode) {
            if (!(n instanceof Element)) continue;
            const id = n.getAttribute('data-dc-' + type);
            const fn = id != null ? this.fns[+id] : undefined;
            if (fn) {
              fn.call(this.c, e);
              if (e.cancelBubble) break;
            }
          }
        });
      }
    }

    /**
     * A fresh DOM fragment from the template for the current values.
     * @param {Scope} vals
     */
    build(vals) {
      this.fns = [];
      const frag = document.createDocumentFragment();
      /**
       * @param {Node} src
       * @param {Node} out
       * @param {Scope} scope
       */
      const walk = (src, out, scope) => {
        for (let node = src.firstChild; node; node = node.nextSibling) {
          if (node instanceof Text) {
            const t = node.data.includes('{{') ? node.data.replace(HOLE, (_, p) => str(lookup(scope, p))) : node.data;
            // Match what the HTML parser makes of prerendered markup: no empty text nodes, and
            // neighbouring text in one node. Otherwise hydration rewrites hundreds of nodes.
            const prev = out.lastChild;
            if (prev instanceof Text) prev.data += t;
            else if (t) out.appendChild(document.createTextNode(t));
          } else if (node instanceof Element) {
            const tag = node.localName;
            if (tag === 'sc-for') {
              const m = ONE_HOLE.exec(node.getAttribute('list') || '');
              const list = m ? lookup(scope, m[1]) : null;
              const as = node.getAttribute('as') || 'item';
              if (Array.isArray(list)) {
                for (const item of list) {
                  const s = Object.create(scope);
                  s[as] = item;
                  walk(node, out, s);
                }
              }
            } else if (tag === 'sc-if') {
              const m = ONE_HOLE.exec(node.getAttribute('value') || '');
              if (m && lookup(scope, m[1])) walk(node, out, scope);
            } else {
              const el = /** @type {Element} */ (node.cloneNode(false));
              for (const { name, value } of Array.from(el.attributes)) {
                if (name.startsWith('hint-placeholder')) {
                  el.removeAttribute(name);
                  continue;
                }
                if (!value.includes('{{')) continue;
                const event = EVENTS[name.toLowerCase()];
                if (event) {
                  el.removeAttribute(name);
                  const fm = ONE_HOLE.exec(value);
                  const fn = fm ? lookup(scope, fm[1]) : null;
                  if (typeof fn === 'function') {
                    this.fns.push(/** @type {Handler} */ (fn));
                    el.setAttribute('data-dc-' + event, String(this.fns.length - 1));
                  }
                  continue;
                }
                const one = ONE_HOLE.exec(value);
                const v = one ? lookup(scope, one[1]) : value.replace(HOLE, (_, p) => str(lookup(scope, p)));
                if (v == null || v === false) el.removeAttribute(name);
                else el.setAttribute(name, v === true ? '' : String(v));
              }
              walk(node instanceof HTMLTemplateElement ? node.content : node, el, scope);
              out.appendChild(el);
            }
          }
        }
      };
      walk(this.template.content, frag, vals);
      return frag;
    }

    render() {
      const c = this.c;
      const holder = document.createElement('div');
      holder.appendChild(this.build((c.renderVals && c.renderVals()) || {}));
      if (this.transform) {
        try {
          this.transform(holder);
        } catch (e) {
          console.error(e);
        }
      }
      // What this render looks like, kept for comparing with the next one (patching moves nodes out).
      const snapshot = holder.cloneNode(true);
      if (this.prev) patchKeep(this.root, this.prev, holder);
      else patchChildren(this.root, holder);
      this.prev = snapshot;
      if (!this.mounted) {
        this.mounted = true;
        this.mounting = true;
        try {
          if (c.componentDidMount) c.componentDidMount();
        } finally {
          this.mounting = false;
        }
      } else if (c.componentDidUpdate) {
        c.componentDidUpdate();
      }
    }
  }

  // ---- patching ----

  /**
   * @param {Node} a
   * @param {Node} b
   */
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (!(a instanceof Element) || !(b instanceof Element)) return true;
    return a.localName === b.localName && (a.id || '') === (b.id || '');
  }

  /**
   * @param {Element} a the live element
   * @param {Element} b the new render's element
   */
  function syncAttrs(a, b) {
    if (a.localName === 'canvas') return; // owned by effects code
    for (const { name, value } of Array.from(b.attributes)) {
      if (a.getAttribute(name) !== value) a.setAttribute(name, value);
    }
    for (const { name } of Array.from(a.attributes)) {
      if (b.hasAttribute(name)) continue;
      if (name === 'open' && (a.localName === 'details' || a.localName === 'dialog')) continue; // user-toggled, or opened with showModal()
      if (name === 'tabindex' && a.getAttribute(name) === '-1') continue; // set by code to move focus to a section
      a.removeAttribute(name);
    }
    // Typed values only: a checkbox's or radio's value attribute isn't what the user changes.
    const typed = (a instanceof HTMLInputElement && !/^(checkbox|radio)$/i.test(a.type)) || a instanceof HTMLTextAreaElement;
    if (typed && document.activeElement !== a) {
      const v = b.getAttribute('value') || '';
      if (a.value !== v) a.value = v;
    }
  }

  /**
   * Make oldEl's children match newEl's, reusing nodes that look the same (a short look-ahead).
   * @param {Node} oldEl
   * @param {Node} newEl
   */
  function patchChildren(oldEl, newEl) {
    let o = oldEl.firstChild;
    let n = newEl.firstChild;
    while (n) {
      const next = n.nextSibling;
      let found = null;
      for (let c = o, k = 0; c && k < 8; c = c.nextSibling, k++) {
        if (sameNode(c, n)) {
          found = c;
          break;
        }
      }
      if (found) {
        while (o && o !== found) {
          const r = o;
          o = o.nextSibling;
          oldEl.removeChild(r);
        }
        patchNode(found, n);
        o = found.nextSibling;
      } else {
        oldEl.insertBefore(n, o);
      }
      n = next;
    }
    while (o) {
      const rm = o;
      o = o.nextSibling;
      oldEl.removeChild(rm);
    }
  }

  /**
   * Patch only what changed since the last render, by comparing the new render with the previous
   * one rather than with the page. Anything unchanged is left exactly as it is on the page, along
   * with whatever else changed it: the browser's own page translation (which swaps text for
   * wrapped, translated copies), a disclosure the visitor opened, a class added for an effect.
   * Where the structure itself changed (a section shown or hidden), it falls back to a full patch.
   * @param {Node} live
   * @param {Node} prev
   * @param {Node} next
   */
  function patchKeep(live, prev, next) {
    const L = Array.from(live.childNodes), P = Array.from(prev.childNodes), N = Array.from(next.childNodes);
    if (P.length !== N.length || L.length !== N.length) {
      patchChildren(live, next);
      return;
    }
    N.forEach((n, i) => {
      const a = L[i], o = P[i];
      if (o.isEqualNode(n)) return;
      if (a instanceof Element && o instanceof Element && n instanceof Element && sameNode(a, n) && o.localName === n.localName) {
        syncAttrs(a, n);
        if (a.localName !== 'canvas') patchKeep(a, o, n);
      } else if (a instanceof Text && n instanceof Text) {
        if (a.data !== n.data) a.data = n.data;
      } else {
        live.replaceChild(n, a);
      }
    });
  }

  /**
   * @param {Node} a
   * @param {Node} b
   */
  function patchNode(a, b) {
    if (a instanceof CharacterData && b instanceof CharacterData) {
      if (a.data !== b.data) a.data = b.data;
      return;
    }
    if (!(a instanceof Element) || !(b instanceof Element)) return;
    syncAttrs(a, b);
    if (a.localName === 'canvas') return;
    patchChildren(a, b);
  }

  /**
   * Default props from the design file's data-props (each { default } entry; $-keys are canvas-only).
   * @param {Element} script
   */
  function readProps(script) {
    /** @type {Record<string, unknown>} */
    const props = {};
    let spec;
    try {
      spec = JSON.parse(script.getAttribute('data-props') || '{}');
    } catch (e) {
      console.error('dc-runtime: unreadable data-props', e);
      return props;
    }
    for (const [k, v] of Object.entries(spec)) {
      if (!k.startsWith('$') && v && typeof v === 'object' && 'default' in v) props[k] = v.default;
    }
    return props;
  }

  /**
   * Mount a design file's component on the page.
   * @param {{ root: string, template: string, script: string, props?: Record<string, unknown> }} opts selectors, and props over the file's defaults
   */
  function mount(opts) {
    const root = /** @type {HTMLElement} */ (document.querySelector(opts.root));
    const template = /** @type {HTMLTemplateElement} */ (document.querySelector(opts.template));
    const script = /** @type {HTMLScriptElement} */ (document.querySelector(opts.script));
    // The design file's script defines `class Component extends DCLogic` in its own scope.
    const ComponentClass = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    const app = new App(root, template, ComponentClass, Object.assign(readProps(script), opts.props || {}));
    app.render();
    addEventListener('pagehide', () => {
      try {
        if (app.c.componentWillUnmount) app.c.componentWillUnmount();
      } catch (e) {
        console.error(e);
      }
    });
    return app;
  }

  /** @type {any} */ (window).DCRuntime = { mount, DCLogic };
})();
