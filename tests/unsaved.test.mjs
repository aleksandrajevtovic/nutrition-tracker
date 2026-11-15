import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {DraftRegistry} = await loadTypeScript(new URL('../src/unsaved.ts', import.meta.url));
const draft = (label, scope, dirty = true, busy = false) => ({label, scope, dirty, busy});

test('unchanged forms and unrelated scopes never ask for confirmation', () => {
  const registry = new DraftRegistry();
  registry.drafts.set('note', draft('Tagesnotiz', 'note', false));
  registry.drafts.set('recipe', draft('Rezept', 'recipe'));
  assert.equal(registry.canLeave(() => assert.fail('Unexpected prompt'), () => assert.fail('Unexpected busy'), ['note']), true);
});

test('cancelling preserves all registered drafts; accepting is explicit and leaves cleanup to the navigation', () => {
  const registry = new DraftRegistry();
  registry.drafts.set('note', draft('Tagesnotiz', 'note'));
  let message;
  assert.equal(registry.canLeave(text => {message = text; return false;}, () => {}), false);
  assert.match(message, /Tagesnotiz/);
  assert.match(message, /Abbrechen/);
  assert.equal(registry.pending().length, 1);
  assert.equal(registry.canLeave(() => true, () => {}), true);
  assert.equal(registry.pending().length, 1);
  registry.drafts.delete('note');
  assert.equal(registry.pending().length, 0);
});

test('a running save blocks navigation even if its form was pristine and cannot be discarded', () => {
  const registry = new DraftRegistry();
  registry.drafts.set('drink', draft('Getränk', 'drink', false, true));
  let busyCount = 0;
  assert.equal(registry.canLeave(() => assert.fail('A running save must not ask to discard'), () => busyCount++), false);
  assert.equal(busyCount, 1);
  registry.drafts.set('drink', draft('Getränk', 'drink', false, false));
  assert.equal(registry.canLeave(() => assert.fail('Saved form must be clean'), () => {}), true);
});

test('scope prefixes protect all quantity forms while closing one form only checks that entry', () => {
  const registry = new DraftRegistry();
  registry.drafts.set('one', draft('Menge eins', 'quantity:one'));
  registry.drafts.set('two', draft('Menge zwei', 'quantity:two'));
  registry.drafts.set('recipe', draft('Rezept', 'recipe'));
  assert.equal(registry.pending(['quantity:']).length, 2);
  assert.equal(registry.pending(['quantity:one']).length, 1);
  let message;
  registry.canLeave(text => {message = text; return false;}, () => {}, ['quantity:one']);
  assert.ok(!message.includes('Menge zwei'));
  assert.ok(!message.includes('Rezept'));
});
