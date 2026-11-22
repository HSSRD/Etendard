// Garde-fou « Jamais publié » (ADR 0016) : aucun texte de src/content/ ne contient les motifs
// génériques des données exclues. Les exemples ci-dessous sont factices.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const motifs: [string, RegExp][] = [
  // Au moins un chiffre : « FRAMEWORK » n'est pas un numéro.
  ['numéro d’exploitant (FRA…)', /\bFRA(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,}/],
  ['« commande n° »', /commande\s*(?:n[°º]|no\.?\s*\d|num[ée]ro|#\s*\d)/i],
  ['« n° de commande »', /(?:n[°º]|\bno\.?|num[ée]ro)\s*(?:de\s+)?commande/i],
  // Drapeau u : sans lui, \b ne voit pas « é » comme une lettre (« facturé »).
  [
    '« facture »',
    /(?<![\p{L}\d])factur(?:e|es|ée?s?|ation|er|ez)(?![\p{L}\d])/iu,
  ],
  ['« code promo »', /\bcodes?[\s-]+promo/i],
  ['paramètre d’affiliation d’URL', /[?&](?:tag|ref|aff\w*)=/i],
];

/** Motifs présents dans `text`. */
const found = (text: string) =>
  motifs.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

const root = new URL('../src/content/', import.meta.url);
const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /\.tsx?$/.test(file));

describe('Jamais publié', () => {
  it.each([
    ['FRA0000xxxx0000', 'numéro d’exploitant (FRA…)'],
    ['Commande n° 0000', '« commande n° »'],
    ['le n° de commande', '« n° de commande »'],
    ['voir la facture', '« facture »'],
    ['le prix facturé.', '« facture »'],
    ['Commande nº 0000', '« commande n° »'],
    ['le numéro de commande', '« n° de commande »'],
    ['voir n° commande 0000', '« n° de commande »'],
    ['la commande #0000', '« commande n° »'],
    ['à facturer', '« facture »'],
    ['le numero de commande', '« n° de commande »'],
    ['No de commande', '« n° de commande »'],
    ['commande numero 0000', '« commande n° »'],
    ['le code-promo ESSAI', '« code promo »'],
    ['un Code promo', '« code promo »'],
    ['https://exemple.test/x?tag=essai-21', 'paramètre d’affiliation d’URL'],
    ['https://exemple.test/x?affid=1', 'paramètre d’affiliation d’URL'],
    ['https://exemple.test/x?a=1&ref=essai', 'paramètre d’affiliation d’URL'],
  ])('reconnaît « %s »', (text, name) => {
    expect(found(text)).toEqual([name]);
  });

  it.each([
    'France',
    'FRAME',
    'FRAMEWORK',
    'une commande passée',
    'un piano de commande',
    'référence du moteur',
    'https://exemple.test/?page=2',
  ])('laisse passer « %s »', (text) => {
    expect(found(text)).toEqual([]);
  });

  it('src/content/ a des fichiers à vérifier', () => {
    expect(files).toContain('projects.ts');
  });

  it.each(files)('src/content/%s ne contient aucun motif exclu', (file) => {
    expect(
      found(readFileSync(new URL(file, root), 'utf8')),
      `src/content/${file}`,
    ).toEqual([]);
  });
});
