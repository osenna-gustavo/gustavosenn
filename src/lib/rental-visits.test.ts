import { describe, expect, test } from 'bun:test';
import { DEFAULT_RENTAL_STATUS, RENTAL_STATUSES, formatVisit, visitToInput, visitToISO } from './rental-visits';

describe('rental visits', () => {
  test('allows exactly the four requested statuses', () => {
    expect([...RENTAL_STATUSES]).toEqual(['agendar_visita', 'visita_agendada', 'visitado', 'descartado']);
    expect(DEFAULT_RENTAL_STATUS).toBe('agendar_visita');
  });
  test('interprets November 3 2026 14:30 in Sao Paulo, not the browser timezone', () => {
    expect(visitToISO('2026-11-03T14:30')).toBe('2026-11-03T17:30:00.000Z');
  });
  test('reopens the saved visit at the original Sao Paulo time', () => {
    expect(visitToInput('2026-11-03T17:30:00.000Z')).toBe('2026-11-03T14:30');
    expect(formatVisit('2026-11-03T17:30:00.000Z')).toBe('ter, 03/11/2026 às 14:30');
  });
  test('allows an absent date without forcing a timestamp', () => {
    expect(visitToISO('')).toBeNull();
    expect(visitToInput(null)).toBe('');
  });
});