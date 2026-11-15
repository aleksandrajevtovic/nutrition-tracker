import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {openDB} from 'idb';
import {loadTypeScript} from './helpers/typescript.mjs';

const {createDayNote, validNote, backupNotes, emptyNoteValues} = await loadTypeScript(new URL('../src/notes.ts', import.meta.url));
const previous = await openDB('nutrition-tracker', 5, {upgrade(db) {
  db.createObjectStore('foods', {keyPath: 'id'});
  db.createObjectStore('entries', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('weights', {keyPath: 'date'});
  db.createObjectStore('settings');
  db.createObjectStore('templates', {keyPath: 'id'});
  db.createObjectStore('plans', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('shopping');
}});
await previous.put('weights', {date: '2026-11-15', kg: 72, updatedAt: '2026-11-15T00:00:00Z'});
await previous.put('settings', '2026-11-15T12:00:00Z', 'lastBackupExport');
previous.close();
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const values = {hunger: 'Nachmittags hungrig', energy: 'Viel Energie', training: 'Krafttraining', observations: 'Erste Zeile\nZweite Zeile'};

test('daily notes accept optional fields, trim outer whitespace and preserve multiline text', () => {
  assert.equal(createDayNote('2026-11-15', emptyNoteValues()), null);
  const note = createDayNote('2026-11-15', {...values, hunger: '  Hungrig  '});
  assert.equal(note.hunger, 'Hungrig');
  assert.equal(note.observations, values.observations);
  assert.equal(validNote(note), true);
  assert.equal(validNote({...note, date: '2026-02-30'}), false);
  assert.equal(validNote({...note, energy: 2}), false);
  assert.equal(validNote({...note, updatedAt: 'invalid'}), false);
  assert.throws(() => createDayNote('2026-02-30', values));
});

test('note backups reject malformed or duplicate dates and preserve old backup compatibility', () => {
  const note = createDayNote('2026-11-15', values);
  assert.deepEqual(backupNotes({version: 5, dailyNotes: [note]}), [note]);
  assert.deepEqual(backupNotes({version: 5, dailyNotes: []}), []);
  assert.equal(backupNotes({version: 4}), undefined);
  assert.throws(() => backupNotes({version: 5}));
  assert.throws(() => backupNotes({version: 5, dailyNotes: [note, note]}));
});

test('notes persist independently per day and survive migrations, undo and backups', async t => {
  const first = createDayNote('2026-11-15', values);
  const second = createDayNote('2026-11-16', {...emptyNoteValues(), observations: 'Anderer Tag'});
  await t.test('upgrade leaves existing weights and export history intact', async () => {
    assert.equal((await db.listWeights())[0].kg, 72);
    assert.equal(await db.getLastBackupExport(), '2026-11-15T12:00:00Z');
    assert.equal(await db.getDayNote(first.date), undefined);
  });
  await t.test('updates replace only the selected day and empty neighbors remain empty', async () => {
    await db.saveDayNote(first); await db.saveDayNote(second);
    await db.saveDayNote({...first, energy: 'Weniger Energie'});
    assert.equal((await db.getDayNote(first.date)).energy, 'Weniger Energie');
    assert.equal((await db.getDayNote(second.date)).observations, 'Anderer Tag');
    assert.equal(await db.getDayNote('2026-11-17'), undefined);
    assert.equal((await db.getBackup()).dailyNotes.length, 2);
    await assert.rejects(db.saveDayNote({...first, date: 'invalid'}));
  });
  await t.test('undo restores deleted notes without overwriting newer notes', async () => {
    const revision = db.getDataRevision();
    const removed = await db.removeDayNote(first.date);
    assert.equal(await db.getDayNote(first.date), undefined);
    await db.restoreDeletedDayNote(removed, revision);
    assert.equal((await db.getDayNote(first.date)).energy, 'Weniger Energie');
    await assert.rejects(db.restoreDeletedDayNote(removed, revision), /Änderungen/);
  });
  await t.test('current backups restore notes and old backups keep them unchanged', async () => {
    const backup = await db.getBackup();
    assert.equal(backup.version, 6);
    await db.removeDayNote(first.date);
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    assert.equal((await db.getDayNote(first.date)).energy, 'Weniger Energie');
    const {dailyNotes, ...legacy} = backup;
    await db.restoreBackup({...legacy, version: 4});
    assert.equal((await db.getDayNote(first.date)).energy, 'Weniger Energie');
    const invalid = {...backup, dailyNotes: [{...first, observations: 42}], weights: []};
    await assert.rejects(db.restoreBackup(invalid), /Tagesnotizen/);
    assert.equal((await db.listWeights()).length, 1);
    await db.restoreBackup({...backup, dailyNotes: []});
    assert.equal(await db.getDayNote(first.date), undefined);
    assert.equal(await db.getDayNote(second.date), undefined);
  });
});
