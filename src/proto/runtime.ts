// @ts-nocheck
// Engine that runs a design-canvas board (prototype/*.dc.html) as the live app.
// It parses the board's template once, then renders it with React on every state change.
// Template rules it understands: {{ dotted.holes }}, <sc-for list as>, <sc-if value>.
// <sc-if> also takes `eq="text"` (show when the value equals the text) and `not` (invert the test).
import React from 'react';
import { createRoot } from 'react-dom/client';

var h = React.createElement;
var VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1, source: 1, col: 1, wbr: 1 };
var NOWS = { table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, select: 1, colgroup: 1, ul: 1, ol: 1, svg: 1, defs: 1 };
var BOOL = { disabled: 1, checked: 1, selected: 1, hidden: 1, required: 1, multiple: 1 };
var RENAME = { 'class': 'className', 'for': 'htmlFor', autocomplete: 'autoComplete', inputmode: 'inputMode', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', readonly: 'readOnly', enterkeyhint: 'enterKeyHint', autocapitalize: 'autoCapitalize', spellcheck: 'spellCheck' };
var ta = null;
function decode(s) {
  if (s.indexOf('&') < 0) return s;
  if (!ta) { if (typeof document === 'undefined') return s; ta = document.createElement('textarea'); }
  ta.innerHTML = s; return ta.value;
}
function camel(s) { return s.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }); }

// text or attribute value -> parts: strings and {h: 'dotted.path'}
function parts(s) {
  var out = [], re = /\{\{\s*([^}]+?)\s*\}\}/g, last = 0, m;
  while ((m = re.exec(s))) { if (m.index > last) out.push(decode(s.slice(last, m.index))); out.push({ h: m[1] }); last = re.lastIndex; }
  if (last < s.length) out.push(decode(s.slice(last)));
  return out;
}

export function parse(src) {
  var root = { tag: '#root', kids: [] }, stack = [root];
  var re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|[^">])*)>/g, last = 0, m;
  function realParent() { for (var i = stack.length - 1; i >= 0; i--) { var t = stack[i].tag; if (t !== 'sc-for' && t !== 'sc-if') return t; } return ''; }
  function text(t) {
    if (!t) return;
    if (!/\S/.test(t) && (t.indexOf('\n') >= 0 || NOWS[realParent()])) return;
    stack[stack.length - 1].kids.push({ text: parts(t.replace(/\s*\n\s*/g, ' ')) });
  }
  while ((m = re.exec(src))) {
    text(src.slice(last, m.index)); last = re.lastIndex;
    if (m[0].charAt(1) === '!') continue;
    var tag = m[2];
    if (m[1]) { for (var i = stack.length - 1; i > 0; i--) { if (stack[i].tag === tag) { stack.length = i; break; } } continue; }
    var node = { tag: tag, attrs: [], kids: [] }, ar = /([^\s=\/"]+)(?:="([^"]*)")?/g, a;
    while ((a = ar.exec(m[3]))) node.attrs.push({ n: a[1], v: a[2] === undefined ? null : parts(a[2]) });
    stack[stack.length - 1].kids.push(node);
    if (!VOID[tag.toLowerCase()] && !/\/\s*$/.test(m[3])) stack.push(node);
  }
  text(src.slice(last));
  return root;
}

export function get(scope, path) {
  if (path === 'true') return true; if (path === 'false') return false;
  var ps = path.split('.');
  for (var s = scope.length - 1; s >= 0; s--) {
    if (scope[s] != null && Object.prototype.hasOwnProperty.call(scope[s], ps[0])) { var v = scope[s]; for (var i = 0; i < ps.length; i++) { if (v == null) return undefined; v = v[ps[i]]; } return v; }
  }
  return undefined;
}
function str(p, scope) { var o = ''; for (var i = 0; i < p.length; i++) { var x = p[i]; if (typeof x === 'string') o += x; else { var v = get(scope, x.h); if (v != null && typeof v !== 'function' && typeof v !== 'object') o += v; } } return o; }
function val(p, scope) { if (p === null) return true; if (p.length === 1 && typeof p[0] !== 'string') return get(scope, p[0].h); return str(p, scope); }

var styleCache = new Map();
function styleObj(s) {
  var hit = styleCache.get(s); if (hit) return hit;
  var o = {}, depth = 0, cur = '', decls = [];
  for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === '(') depth++; else if (c === ')') depth--; if (c === ';' && depth === 0) { decls.push(cur); cur = ''; } else cur += c; }
  decls.push(cur);
  decls.forEach(function (d) { var k = d.indexOf(':'); if (k < 0) return; var name = d.slice(0, k).trim(), v = d.slice(k + 1).trim(); if (!name || !v) return; o[name.indexOf('--') === 0 ? name : camel(name.replace(/^-(webkit|moz|ms)-/, function (m, p) { return (p === 'ms' ? 'ms' : p.charAt(0).toUpperCase() + p.slice(1)) + '-'; }))] = v; });
  if (styleCache.size > 20000) styleCache.clear();
  styleCache.set(s, o); return o;
}
function asBool(v) { return v === true || v === 'true' || (v !== false && v !== 'false' && v !== '' && v != null && v !== 0); }

function renderKids(kids, scope, ctx) {
  var out = [];
  for (var i = 0; i < kids.length; i++) { var r = render(kids[i], scope, ctx, i); if (r != null && r !== '') out.push(r); }
  return out;
}
function attr(node, name) { for (var i = 0; i < node.attrs.length; i++) if (node.attrs[i].n === name) return node.attrs[i].v; return undefined; }

function render(node, scope, ctx, key) {
  if (node.text) return str(node.text, scope);
  var tag = node.tag;
  if (tag === 'helmet') return null;
  if (tag === 'sc-for') {
    var list = val(attr(node, 'list'), scope), as = str(attr(node, 'as'), scope);
    if (!Array.isArray(list)) return null;
    return h(React.Fragment, { key: key }, list.map(function (it, n) { var sc = {}; sc[as] = it; return h(React.Fragment, { key: n }, renderKids(node.kids, scope.concat([sc]), ctx)); }));
  }
  if (tag === 'sc-if') {
    var cv = val(attr(node, 'value'), scope), eq = attr(node, 'eq');
    var ok = eq !== undefined ? String(cv) === str(eq || [], scope) : asBool(cv);
    if (attr(node, 'not') !== undefined) ok = !ok;
    return ok ? h(React.Fragment, { key: key }, renderKids(node.kids, scope, ctx)) : null;
  }
  var props = { key: key }, lt = tag.toLowerCase(), hasChange = false, value, checked, selected = false;
  for (var i = 0; i < node.attrs.length; i++) {
    var a = node.attrs[i], n = a.n;
    if (n.indexOf('hint-') === 0) continue;
    var v = val(a.v, scope);
    if (n === 'style') { props.style = styleObj(typeof v === 'string' ? v : ''); continue; }
    if (/^on[A-Z]/.test(n)) { if (typeof v === 'function') { props[n] = v; if (n === 'onChange') hasChange = true; } continue; }
    if (n === 'value' && (lt === 'input' || lt === 'textarea' || lt === 'select')) { value = v == null ? '' : v; continue; }
    if (n === 'checked') { checked = asBool(v); continue; }
    if (n === 'selected') { selected = asBool(v); continue; }
    if (BOOL[n]) { props[n] = asBool(v); continue; }
    if (v == null || typeof v === 'function') continue;
    var pn = RENAME[n] || ((n.indexOf('-') > 0 && n.indexOf('aria-') !== 0 && n.indexOf('data-') !== 0) ? camel(n) : n);
    props[pn] = typeof v === 'boolean' ? String(v) : v;
  }
  if (lt === 'option') { if (selected && ctx) ctx.sel = props.value; return h(tag, props, renderKids(node.kids, scope, null)); }
  if (lt === 'select') {
    var c2 = {}, kids = renderKids(node.kids, scope, c2);
    if (c2.sel !== undefined) { if (hasChange) props.value = c2.sel; else props.defaultValue = c2.sel; }
    return h(tag, props, kids);
  }
  if (lt === 'input' || lt === 'textarea') {
    if (value !== undefined) { if (hasChange) props.value = value; else props.defaultValue = value; }
    if (checked !== undefined) { if (hasChange) props.checked = checked; else props.defaultChecked = checked; }
    return h(tag, props);
  }
  if (VOID[lt]) return h(tag, props);
  var ks = renderKids(node.kids, scope, null);
  return ks.length ? h(tag, props, ks) : h(tag, props);
}

export function DCLogic(props) { this.props = props || {}; this.state = {}; }
DCLogic.prototype.setState = function (p, cb) {
  var patch = typeof p === 'function' ? p(this.state) : p;
  if (patch) this.state = Object.assign({}, this.state, patch);
  if (this.__force) this.__force();
  if (typeof cb === 'function') cb();
};

/** Renders a design-canvas component (template + Component class) as a React app.
 *  `alt` is optional: a second template shown while its media query matches (the phone layout).
 *  Both layouts share one Component instance, so state survives a rotate or a window resize. */
export function mountPrototype(Component, tplSrc, el, alt?) {
  var ast = parse(tplSrc), altAst = null;
  var mq = alt && window.matchMedia ? window.matchMedia(alt.query) : null;
  function watch(cb) { mq.addEventListener('change', cb); return function () { mq.removeEventListener('change', cb); }; }
  function matches() { return mq.matches; }
  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(e) { return { err: e }; }
    render() { return this.state.err ? h('p', { style: { padding: 24, fontSize: 14 } }, 'Something went wrong. Reload the page to start again.') : this.props.children; }
  }
  function App() {
    var force = React.useReducer(function (x) { return x + 1; }, 0)[1];
    var useAlt = mq ? React.useSyncExternalStore(watch, matches) : false;
    var ref = React.useRef(null);
    if (!ref.current) ref.current = new Component({});
    ref.current.__force = force;
    ref.current.__alt = useAlt;
    if (useAlt && !altAst) altAst = parse(alt.template);
    var vals = ref.current.renderVals();
    React.useEffect(function () { if (ref.current.afterRender) ref.current.afterRender(); });
    return h(React.Fragment, null, renderKids((useAlt ? altAst : ast).kids, [vals], null));
  }
  createRoot(el).render(h(Boundary, null, h(App)));
}
