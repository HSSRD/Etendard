// Compose l'e-mail de résultat de deploy.yml (ticket #32), lancé par le job `message`.
// Usage : node scripts/deploy-notify.js            → { subject, textContent, htmlContent } en JSON
//         node scripts/deploy-notify.js --a-blanc  → l'e-mail lisible, sans envoi
// Adresses, clé API et envoi (curl) restent dans le workflow : le script ne voit aucun secret.

const court = (sha) => sha.slice(0, 7);
// Un objet d'e-mail tient sur une ligne, quel que soit le nom de branche ou le titre reçu.
const uneLigne = (texte) => texte.replace(/\s+/g, ' ').trim();
const html = (texte) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @typedef {{ titre: string, url: string, branche: string }} PR
 * @typedef {{
 *   rollback: boolean,
 *   resultats: { deploy: string, release: string, rollback: string },
 *   sha: string,
 *   servi: string,
 *   archiveEnvoyee: boolean,
 *   rollbackEffectue: boolean,
 *   pr: PR | null,
 *   titreCommit: string,
 *   execution: string,
 *   depot: string,
 * }} Contexte
 */

/** @param {Contexte} c */
function objet(c) {
  if (c.rollback) {
    const servi = c.servi
      ? ` — ${court(c.servi)}`
      : ', version servie inconnue';
    return c.resultats.rollback === 'success'
      ? `↩️ Rollback manuel effectué${servi}`
      : `❌ Rollback manuel en échec${servi}`;
  }
  const nom = uneLigne(c.pr?.branche || c.titreCommit || court(c.sha));
  if (c.resultats.deploy === 'success') {
    return `✅ ${nom} déployé — ${court(c.sha)}`;
  }
  return `❌ ${nom} : déploiement en échec, ${etatApresEchec(c)}`;
}

/** @param {Contexte} c */
function etatApresEchec(c) {
  if (c.rollbackEffectue) return 'rollback effectué';
  // Échec avant l'envoi (build, empreinte, tailnet) : le Pi n'a rien reçu.
  if (!c.archiveEnvoyee) return 'version précédente toujours servie';
  if (!c.servi) return 'version servie inconnue';
  if (c.servi === c.sha) return 'nouvelle version servie';
  return 'version précédente toujours servie';
}

/** @param {Contexte} c */
export function composer(c) {
  const lignes = [
    c.pr
      ? `PR : ${uneLigne(c.pr.titre)} — ${c.pr.url}`
      : c.titreCommit
        ? `PR : aucune (commit : ${uneLigne(c.titreCommit)})`
        : 'PR : non lue (API GitHub injoignable)',
    `Commit : ${c.sha || 'inconnu'}`,
    `Version servie par le Pi : ${c.servi || 'inconnue'}`,
    `Exécution : ${c.execution}`,
  ];
  if (c.resultats.release === 'success') {
    lignes.push(`Release : ${c.depot}/releases/tag/deploy-${court(c.sha)}`);
  } else if (c.resultats.release === 'failure') {
    lignes.push('Release : publication en échec, voir l’exécution');
  }
  const texte = `${lignes.join('\n')}\n`;
  // Brevo exige un corps HTML : le texte brut, simplement échappé.
  return {
    subject: objet(c),
    textContent: texte,
    htmlContent: `<pre>${html(texte)}</pre>`,
  };
}

async function github(chemin) {
  const env = process.env;
  const reponse = await fetch(
    `${env.GITHUB_API_URL ?? 'https://api.github.com'}${chemin}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: 'application/vnd.github+json',
        ...(env.GH_TOKEN ? { authorization: `Bearer ${env.GH_TOKEN}` } : {}),
      },
    },
  );
  if (!reponse.ok) throw new Error(`GitHub ${chemin} : HTTP ${reponse.status}`);
  return reponse.json();
}

// Lit le contexte dans l'environnement du job : jamais d'interpolation ${{ }} (critère 5).
async function lireContexte() {
  const env = process.env;
  const rollback = env.ROLLBACK === 'true';
  const servi = /^[0-9a-f]{7,40}$/.test(env.SERVI ?? '') ? env.SERVI : '';
  // Pour un rollback manuel, la PR utile est celle de la version désormais servie.
  const sha = rollback ? servi : env.GITHUB_SHA;
  const depot = `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}`;
  let pr = null;
  let titreCommit = '';
  // PR et titre ne font qu'habiller l'e-mail : s'ils sont illisibles, il part quand même.
  if (sha) {
    try {
      const [premiere] = await github(
        `/repos/${env.GITHUB_REPOSITORY}/commits/${sha}/pulls`,
      );
      if (premiere) {
        pr = {
          titre: premiere.title,
          url: premiere.html_url,
          branche: premiere.head.ref,
        };
      } else {
        const commit = await github(
          `/repos/${env.GITHUB_REPOSITORY}/commits/${sha}`,
        );
        titreCommit = commit.commit.message.split('\n')[0];
      }
    } catch (erreur) {
      console.error(`PR introuvable : ${erreur.message}`);
    }
  }
  return {
    rollback,
    resultats: {
      deploy: env.DEPLOY_RESULT ?? '',
      release: env.RELEASE_RESULT ?? '',
      rollback: env.ROLLBACK_RESULT ?? '',
    },
    sha: sha ?? '',
    servi,
    archiveEnvoyee: ['success', 'failure'].includes(env.ENVOI ?? ''),
    rollbackEffectue: env.ROLLBACK_EFFECTUE === 'true',
    pr,
    titreCommit,
    execution: `${depot}/actions/runs/${env.GITHUB_RUN_ID}`,
    depot,
  };
}

if (import.meta.main) {
  const mail = composer(await lireContexte());
  console.log(
    process.argv.includes('--a-blanc')
      ? `Objet : ${mail.subject}\n\n${mail.textContent}`
      : JSON.stringify(mail),
  );
}
