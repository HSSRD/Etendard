import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { composer } from './deploy-notify.js';

const sha = 'a25e05f0123456789abcdef0123456789abcdef0';
const avant = 'b36f16a0123456789abcdef0123456789abcdef0';
const depot = 'https://github.com/HSSRD/Etendard';
const base = {
  rollback: false,
  resultats: {
    deploy: 'success',
    release: 'success',
    rollback: 'skipped',
  },
  sha,
  servi: sha,
  rollbackEffectue: false,
  pr: {
    titre: 'feat: ajouter les helpers',
    url: `${depot}/pull/29`,
    branche: 'issue-29-helpers-tests',
  },
  titreCommit: '',
  execution: `${depot}/actions/runs/42`,
  depot,
};
const echec = { ...base.resultats, deploy: 'failure', release: 'skipped' };

describe('objet', () => {
  test('réussite : branche de la PR et SHA court', () => {
    expect(composer(base).subject).toBe(
      '✅ issue-29-helpers-tests déployé — a25e05f',
    );
  });

  test('réussite sans PR : titre du commit', () => {
    const mail = composer({
      ...base,
      pr: null,
      titreCommit: 'chore: corriger la CI',
    });
    expect(mail.subject).toBe('✅ chore: corriger la CI déployé — a25e05f');
  });

  test('échec avec rollback effectué', () => {
    const mail = composer({
      ...base,
      resultats: echec,
      servi: avant,
      rollbackEffectue: true,
    });
    expect(mail.subject).toBe(
      '❌ issue-29-helpers-tests : déploiement en échec, rollback effectué',
    );
  });

  test('échec avant toute bascule : version précédente toujours servie', () => {
    const suffixe = ', version précédente toujours servie';
    const build = { ...echec, deploy: 'skipped' };
    expect(composer({ ...base, resultats: build, servi: '' }).subject).toBe(
      `❌ issue-29-helpers-tests : déploiement en échec${suffixe}`,
    );
    expect(composer({ ...base, resultats: echec, servi: avant }).subject).toBe(
      `❌ issue-29-helpers-tests : déploiement en échec${suffixe}`,
    );
  });

  test('échec après la bascule : la version servie est lue, pas supposée', () => {
    const nom = '❌ issue-29-helpers-tests : déploiement en échec';
    expect(composer({ ...base, resultats: echec, servi: '' }).subject).toBe(
      `${nom}, version servie inconnue`,
    );
    expect(composer({ ...base, resultats: echec }).subject).toBe(
      `${nom}, nouvelle version servie`,
    );
  });

  test('rollback manuel réussi ou en échec', () => {
    const rollback = { ...base, rollback: true, sha: avant, servi: avant };
    const resultats = {
      ...base.resultats,
      deploy: 'skipped',
    };
    expect(
      composer({
        ...rollback,
        resultats: { ...resultats, rollback: 'success' },
      }).subject,
    ).toBe('↩️ Rollback manuel effectué — b36f16a');
    expect(
      composer({
        ...rollback,
        resultats: { ...resultats, rollback: 'failure' },
      }).subject,
    ).toBe('❌ Rollback manuel en échec — b36f16a servi');
  });
});

describe('corps', () => {
  test('PR, SHA complet, version servie, exécution et release', () => {
    expect(composer(base).textContent).toBe(
      [
        `PR : feat: ajouter les helpers — ${depot}/pull/29`,
        `Commit : ${sha}`,
        `Version servie par le Pi : ${sha}`,
        `Exécution : ${depot}/actions/runs/42`,
        `Release : ${depot}/releases/tag/deploy-a25e05f`,
        '',
      ].join('\n'),
    );
  });

  test('pas de lien de release si elle n’a pas été publiée', () => {
    const mail = composer({ ...base, resultats: echec, servi: avant });
    expect(mail.textContent).not.toContain('Release');
  });
});

test('une branche au nom piégé reste une donnée', () => {
  const branche = 'x"; $(curl evil) `id`\n\'fin\\';
  const mail = composer({ ...base, pr: { ...base.pr, branche } });

  expect(mail.subject).toBe(
    '✅ x"; $(curl evil) `id` \'fin\\ déployé — a25e05f',
  );
});

describe('script lancé par le job notify', () => {
  const branche = 'x"; $(id)\nfin';
  // Fausse API GitHub : la PR mergée porte une branche au nom piégé.
  const lancer = async (args: string[]) => {
    const api = createServer((requete, reponse) => {
      reponse.setHeader('content-type', 'application/json');
      reponse.end(
        requete.url?.endsWith('/pulls')
          ? JSON.stringify([
              {
                title: 'feat: $(id)',
                html_url: `${depot}/pull/29`,
                head: { ref: branche },
              },
            ])
          : '{}',
      );
    });
    await new Promise<void>((ok) => api.listen(0, '127.0.0.1', ok));
    const { port } = api.address() as AddressInfo;
    try {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        ['scripts/deploy-notify.js', ...args],
        {
          env: {
            GITHUB_API_URL: `http://127.0.0.1:${port}`,
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'HSSRD/Etendard',
            GITHUB_RUN_ID: '42',
            GITHUB_SHA: sha,
            ROLLBACK: 'false',
            DEPLOY_RESULT: 'success',
            RELEASE_RESULT: 'success',
            ROLLBACK_RESULT: 'skipped',
            SERVI: sha,
          },
        },
      );
      return stdout;
    } finally {
      api.close();
    }
  };

  test('écrit l’objet et le texte en JSON', async () => {
    expect(JSON.parse(await lancer([]))).toEqual({
      subject: '✅ x"; $(id) fin déployé — a25e05f',
      textContent: expect.stringContaining('PR : feat: $(id) — '),
    });
  });

  test('à blanc : affiche l’e-mail lisible', async () => {
    expect(await lancer(['--a-blanc'])).toContain(
      'Objet : ✅ x"; $(id) fin déployé — a25e05f\n\nPR : feat: $(id) — ',
    );
  });
});
