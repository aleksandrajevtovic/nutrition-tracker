import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './helpers/typescript.mjs';

const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const {formatExportTime, validExportTime} = await loadTypeScript(new URL('../src/backup.ts', import.meta.url));
const {default: BackupStatus} = await loadTypeScript(new URL('../src/components/BackupStatus.tsx', import.meta.url));

test('export timestamps use German dates and the client timezone including daylight saving', () => {
  assert.match(formatExportTime('2026-11-15T12:30:00.000Z'), /15\.11\.2026,? 13:30/);
  assert.match(formatExportTime('2026-07-15T12:30:00.000Z'), /15\.07\.2026,? 14:30/);
  assert.equal(validExportTime('2026-11-15T12:30:00.000Z'), true);
  for (const value of [undefined, null, '', 'invalid', 42]) assert.equal(validExportTime(value), false);
});

test('the status distinguishes an unknown history from an actual export and loading failures', () => {
  const render = props => renderToStaticMarkup(createElement(BackupStatus, {lastExport: null, loading: false, failed: false, onRetry() {}, ...props}));
  assert.match(render({}), /Noch kein Export erfasst/);
  const html = render({lastExport: '2026-11-15T12:30:00.000Z'});
  assert.match(html, /datetime="2026-11-15T12:30:00.000Z"/i);
  assert.match(html, /13:30 Uhr/);
  assert.match(render({loading: true}), /Exportstatus wird geladen/);
  assert.match(render({failed: true}), /Erneut versuchen/);
});

test('the last export is stored locally, updated only explicitly and never restored from backup metadata', async () => {
  assert.equal(await db.getLastBackupExport(), null);
  await db.getBackup();
  assert.equal(await db.getLastBackupExport(), null);
  const first = '2026-11-15T12:30:00.000Z';
  assert.equal(await db.recordBackupExport(first), first);
  assert.equal(await db.getLastBackupExport(), first);
  await assert.rejects(db.recordBackupExport('invalid'), /Exportzeitpunkt/);
  assert.equal(await db.getLastBackupExport(), first);
  const second = '2026-11-16T08:00:00.000Z';
  await db.recordBackupExport(second);
  const backup = await db.getBackup();
  assert.equal('lastBackupExport' in backup, false);
  await db.restoreBackup({...backup, lastBackupExport: first});
  assert.equal(await db.getLastBackupExport(), second);
  await db.restoreBackup({version: 1, foods: [], entries: []});
  assert.equal(await db.getLastBackupExport(), second);
});
