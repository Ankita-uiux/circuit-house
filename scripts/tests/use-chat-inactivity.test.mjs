import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the hook with deterministic time, browser events and effect cleanup.
const source = readFileSync(new URL('../../artifacts/circuit-house/src/hooks/use-chat-inactivity.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function harness(initialMessages) {
  let refs = [], cursor = 0, deps, cleanup, effect, now = 0, nextId = 0, reminders = 0;
  const timers = new Map();
  const events = new Map();
  const browser = {
    visibilityState: 'visible',
    addEventListener(name, listener) { events.set(name, listener); },
    removeEventListener(name) { events.delete(name); },
  };
  const context = {
    exports: {}, window: browser, document: browser,
    setTimeout(fn, ms) { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require() { return {
      useRef(value) { const index = cursor++; return refs[index] ??= { current: value }; },
      useEffect(fn, nextDeps) {
        if (!deps || nextDeps.some((value, index) => value !== deps[index])) {
          effect = fn; deps = nextDeps;
        }
      },
    }; },
  };
  vm.runInNewContext(compiled, context);
  const state = { enabled: true, pending: false, session: 'one', messages: [...initialMessages] };
  const render = () => {
    cursor = 0; effect = undefined;
    context.exports.useChatInactivity(state.enabled, state.pending, state.session, state.messages, () => {
      reminders++;
      state.messages.push({ role: 'assistant', content: 'Are you still there?' });
    });
    if (effect) { cleanup?.(); cleanup = effect(); }
  };
  render();
  return {
    state, render, get reminders() { return reminders; },
    event(name) { events.get(name)?.(); },
    visibility(value) { browser.visibilityState = value; events.get('visibilitychange')?.(); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); render(); }
    },
  };
}
const conversation = [{ role: 'user', content: 'Sam' }, { role: 'assistant', content: 'How can I help?' }];

test('one reminder at two minutes; gestures, visibility and reopening cannot repeat it', () => {
  const h = harness(conversation);
  h.advance(119_999); assert.equal(h.reminders, 0);
  h.advance(1); assert.equal(h.reminders, 1);
  for (const event of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'input', 'touchstart', 'touchmove']) {
    h.event(event); h.advance(180_000);
  }
  h.visibility('hidden'); h.visibility('visible');
  h.state.enabled = false; h.render(); h.state.enabled = true; h.render();
  h.advance(300_000); assert.equal(h.reminders, 1);
});

test('a user reply enables one new reminder after the response finishes', () => {
  const h = harness(conversation); h.advance(180_000);
  h.state.messages.push({ role: 'user', content: 'Yes, I need a phone' });
  h.state.pending = true; h.render(); h.advance(180_000);
  assert.equal(h.reminders, 1);
  h.state.messages.push({ role: 'assistant', content: 'What is your budget?' });
  h.state.pending = false; h.render(); h.advance(180_000);
  assert.equal(h.reminders, 2);
  h.advance(300_000); assert.equal(h.reminders, 2);
});

test('restored unanswered reminder stays quiet, even after another assistant message', () => {
  const h = harness([...conversation, { role: 'assistant', content: 'Are you still there?' }, { role: 'assistant', content: 'Additional information' }]);
  h.advance(300_000); assert.equal(h.reminders, 0);
  h.state.messages.push({ role: 'user', content: 'Yes' }); h.render(); h.advance(180_000);
  assert.equal(h.reminders, 1);
});

test('new conversation can receive its own reminder', () => {
  const h = harness(conversation); h.advance(180_000);
  h.state.session = 'two'; h.state.messages = [...conversation]; h.render(); h.advance(180_000);
  assert.equal(h.reminders, 2);
});

test('activity postpones the first reminder', () => {
  const h = harness(conversation); h.advance(80_000); h.event('input');
  h.advance(80_000); assert.equal(h.reminders, 0);
  h.advance(40_000); assert.equal(h.reminders, 1);
});
