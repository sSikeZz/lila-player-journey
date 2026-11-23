// node --test src/   (Node 22.6+ runs TypeScript directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from './data.ts';

test('merges movement and events in time order', () => {
  const path = [0, 0.1, 0.1, 10, 0.2, 0.2];
  const ev = [5, 5, 0.15, 0.12]; // loot at t=5
  assert.deepEqual(buildTrack(path, ev), [0, 0.1, 0.1, 5, 0.15, 0.12, 10, 0.2, 0.2]);
});

test('a death after the last sample becomes the end of the line', () => {
  const path = [0, 0.1, 0.1, 5, 0.2, 0.2];
  const ev = [3, 7, 0.25, 0.3]; // killed by bot at t=7
  const track = buildTrack(path, ev);
  assert.deepEqual(track.slice(-3), [7, 0.25, 0.3]);
});

test('at equal time the movement sample comes first, identical points collapse', () => {
  const path = [5, 0.2, 0.2];
  const ev = [5, 5, 0.2, 0.2, 2, 5, 0.3, 0.3];
  assert.deepEqual(buildTrack(path, ev), [5, 0.2, 0.2, 5, 0.3, 0.3]);
});

test('works with no events', () => {
  assert.deepEqual(buildTrack([0, 0.5, 0.5], []), [0, 0.5, 0.5]);
});
