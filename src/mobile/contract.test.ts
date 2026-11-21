// Contract between the phone template and the board's logic.
// The phone layout only works while every value it asks for exists in what the board (plus the
// phone layer) returns. A new board version that renames or drops a value fails here, by name.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { DCLogic, parse } from '../proto/runtime';
import { assemble } from './assemble';
import { withMobile } from './logic';

import bootSrc from '../proto/boot.ts?raw';

const boards = import.meta.glob('../../prototype/*.dc.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const partFiles = import.meta.glob('./tpl/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** The board that boot.ts ships. */
function boardSource(): string {
  const m = /prototype\/([\w.-]+\.dc\.html)\?raw/.exec(bootSrc);
  if (!m) throw new Error('boot.ts no longer imports a board from prototype/');
  const key = Object.keys(boards).find((k) => k.endsWith('/' + m[1]));
  if (!key) throw new Error('board not found: ' + m[1]);
  return boards[key];
}

function template(): string {
  const parts: Record<string, string> = {};
  for (const f of Object.keys(partFiles)) parts[f.replace(/^.*\//, '').replace(/\.html$/, '')] = partFiles[f];
  return assemble(parts.shell, parts);
}

let Component: any = null;
function makeApp(): any {
  if (!Component) {
    const code = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(boardSource())![1];
    Component = withMobile(new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic));
  }
  const app = new Component({});
  app.__alt = true;
  return app;
}

/** Does `path` exist in the scope chain? (A value may be null or empty; it only has to be there.) */
function exists(scope: any[], path: string): boolean {
  if (path === 'true' || path === 'false') return true;
  const ps = path.split('.');
  for (let s = scope.length - 1; s >= 0; s--) {
    if (scope[s] != null && Object.prototype.hasOwnProperty.call(scope[s], ps[0])) {
      let v = scope[s];
      for (const p of ps) { if (v == null || typeof v !== 'object' || !(p in v)) return false; v = v[p]; }
      return true;
    }
  }
  return false;
}
function value(scope: any[], path: string): any {
  const ps = path.split('.');
  for (let s = scope.length - 1; s >= 0; s--) {
    if (scope[s] != null && Object.prototype.hasOwnProperty.call(scope[s], ps[0])) { let v = scope[s]; for (const p of ps) { if (v == null) return undefined; v = v[p]; } return v; }
  }
  return undefined;
}

interface Hole { path: string; seen: boolean; ok: boolean }

/** Walks the whole template (ignoring <sc-if>, so hidden branches are checked too) against one set of values. */
function walk(node: any, scope: any[], holes: Map<string, Hole>, loopVars: string[]): void {
  const note = (parts: any[] | null | undefined) => {
    if (!parts) return;
    for (const p of parts) {
      if (typeof p === 'string') continue;
      const first = p.h.split('.')[0];
      const key = (loopVars.includes(first) ? loopVars.join('>') + '|' : '') + p.h;
      const h = holes.get(key) || { path: p.h, seen: false, ok: false };
      h.seen = true;
      if (exists(scope, p.h)) h.ok = true;
      holes.set(key, h);
    }
  };
  if (node.text) { note(node.text); return; }
  for (const a of node.attrs || []) if (a.n !== 'as' && !a.n.startsWith('hint-')) note(a.v);
  if (node.tag === 'sc-for') {
    const listAttr = node.attrs.find((a: any) => a.n === 'list'), asAttr = node.attrs.find((a: any) => a.n === 'as');
    const as = asAttr.v[0] as string;
    const listPath = listAttr.v[0].h as string;
    const list = value(scope, listPath);
    const items: any[] = Array.isArray(list) ? list : [];
    // With no items the holes inside cannot be checked in this state; another state must cover them.
    for (const it of items) for (const k of node.kids) walk(k, scope.concat([{ [as]: it }]), holes, loopVars.concat([as]));
    if (!items.length) for (const k of node.kids) markUnseen(k, holes, loopVars.concat([as]));
    return;
  }
  for (const k of node.kids || []) walk(k, scope, holes, loopVars);
}
function markUnseen(node: any, holes: Map<string, Hole>, loopVars: string[]): void {
  const note = (parts: any[] | null | undefined) => {
    if (!parts) return;
    for (const p of parts) {
      if (typeof p === 'string') continue;
      const first = p.h.split('.')[0];
      const key = (loopVars.includes(first) ? loopVars.join('>') + '|' : '') + p.h;
      if (!holes.has(key)) holes.set(key, { path: p.h, seen: false, ok: false });
    }
  };
  if (node.text) { note(node.text); return; }
  for (const a of node.attrs || []) if (a.n !== 'as' && !a.n.startsWith('hint-')) note(a.v);
  const more = node.tag === 'sc-for' ? loopVars.concat([node.attrs.find((a: any) => a.n === 'as').v[0]]) : loopVars;
  for (const k of node.kids || []) markUnseen(k, holes, more);
}

/** App states to check: every role, every main view, every lead open on every tab, plus the sheets. */
function* states(): Generator<{ name: string; vals: any }> {
  const roles = ['anitha', 'harsha', 'ravi', 'vikram'];
  for (const me of roles) {
    for (const view of ['today', 'stats', 'learn', 'admin']) {
      const app = makeApp();
      app.state = { ...app.state, me, view };
      yield { name: `${me}/${view}`, vals: app.renderVals() };
      if (view === 'today') for (const mSheet of ['alerts', 'menu', 'search']) { app.state = { ...app.state, mSheet, q: 'ka' }; yield { name: `${me}/today/${mSheet}`, vals: app.renderVals() }; }
      if (view === 'stats') for (const stTab of ['leads', 'calls', 'board']) { app.state = { ...app.state, stTab, stPer: 'custom' }; yield { name: `${me}/stats/${stTab}`, vals: app.renderVals() }; }
      if (view === 'learn') for (const lnTab of ['play', 'less', 'news']) { app.state = { ...app.state, lnTab }; yield { name: `${me}/learn/${lnTab}`, vals: app.renderVals() }; }
      if (view === 'admin') for (const adTab of ['rules', 'msg', 'log']) for (const msTab of ['journey', 'tpl', 'sent', 'rules']) { app.state = { ...app.state, adTab, msTab }; yield { name: `${me}/admin/${adTab}/${msTab}`, vals: app.renderVals() }; }
    }
    for (let sel = 0; sel < 12; sel++) {
      const app = makeApp();
      app.state = { ...app.state, me, view: 'today', sel, open: true };
      for (const mTab of ['sum', 'quotes', 'hist', 'cust']) { app.state = { ...app.state, mTab }; yield { name: `${me}/lead${sel}/${mTab}`, vals: app.renderVals() }; }
      // a call, then the outcome sheet and the composer
      app.renderVals().startCall();
      app.state = { ...app.state, mSheet: 'outcome' };
      app.renderVals().pickConn();
      yield { name: `${me}/lead${sel}/call`, vals: app.renderVals() };
      app.renderVals().panelWa();
      yield { name: `${me}/lead${sel}/message`, vals: app.renderVals() };
      app.state = { ...app.state, msg: null, mSheet: null, fOpen: true, qview: { k: sel, v: 'prev' }, rec: 'docs', mTab: 'hist', mHistSeg: 'svc' };
      yield { name: `${me}/lead${sel}/prev`, vals: app.renderVals() };
    }
  }
}

describe('phone template and board logic', () => {
  it('every value the phone template uses exists in the board (or the phone layer)', () => {
    const ast = parse(template());
    const holes = new Map<string, Hole>();
    let n = 0;
    for (const st of states()) { n++; for (const k of ast.kids) walk(k, [st.vals], holes, []); }
    expect(n).toBeGreaterThan(100);
    const missing = [...holes.values()].filter((h) => h.seen && !h.ok).map((h) => h.path).sort();
    expect(missing, 'values the phone template uses that no longer exist:\n' + missing.join('\n')).toEqual([]);
  }, 60000);

  it('no loop variable hides a board value', () => {
    const app = makeApp();
    const top = new Set(Object.keys(app.renderVals()));
    const bad: string[] = [];
    const scan = (node: any) => {
      if (node.tag === 'sc-for') { const as = node.attrs.find((a: any) => a.n === 'as').v[0]; if (top.has(as)) bad.push(as); }
      for (const k of node.kids || []) scan(k);
    };
    scan(parse(template()));
    expect(bad, 'loop variables that shadow a top-level value: ' + bad.join(', ')).toEqual([]);
  });
});
