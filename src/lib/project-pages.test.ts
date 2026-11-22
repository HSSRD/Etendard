import { describe, expect, it } from 'vitest';
import { cellText } from './project-pages';

const date = '2026-11-20';

describe('cellText', () => {
  it('affiche un prix en fourchette datée, milliers séparés', () => {
    expect(cellText({ price: { min: 349.9, max: 1200, date } })).toBe(
      '349,9 à 1 200 €, relevé le 2026-11-20',
    );
  });

  it('affiche un budget ponctuel ou une fourchette négative, datés', () => {
    expect(cellText({ budget: { min: 1200, max: 1200, date } })).toBe(
      '1 200 €, prévu le 2026-11-20',
    );
    expect(cellText({ budget: { min: -5, max: 155, date } })).toBe(
      '−5 à 155 €, prévu le 2026-11-20',
    );
  });
});
