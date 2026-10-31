/// <reference types="node" />
import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DEFAULT_RENTAL_STATUS, RENTAL_STATUSES, formatVisit, visitToInput, visitToISO } from './rental-visits';

describe('rental visits', () => {
  test('allows exactly the four requested statuses', () => {
    assert.deepEqual([...RENTAL_STATUSES], ['agendar_visita', 'visita_agendada', 'visitado', 'descartado']);
    assert.equal(DEFAULT_RENTAL_STATUS, 'agendar_visita');
  });
  test('interprets November 3 2026 14:30 in Sao Paulo, not the browser timezone', () => {
    assert.equal(visitToISO('2026-11-03T14:30'), '2026-11-03T17:30:00.000Z');
  });
  test('reopens the saved visit at the original Sao Paulo time', () => {
    assert.equal(visitToInput('2026-11-03T17:30:00.000Z'), '2026-11-03T14:30');
    assert.equal(formatVisit('2026-11-03T17:30:00.000Z'), 'ter, 03/11/2026 às 14:30');
  });
  test('allows an absent date without forcing a timestamp', () => {
    assert.equal(visitToISO(''), null);
    assert.equal(visitToInput(null), '');
  });
});