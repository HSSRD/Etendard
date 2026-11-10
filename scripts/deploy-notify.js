// Compose l'e-mail envoyé par le job `notify` de deploy.yml (ticket #32).
// Usage : node scripts/deploy-notify.js            → corps JSON de l'API Brevo sur stdout
//         node scripts/deploy-notify.js --a-blanc  → objet et texte, sans adresse ni envoi
// L'envoi lui-même (curl) et les secrets restent dans le workflow.

const court = (sha) => sha.slice(0, 7);
// Un objet d'e-mail tient sur une ligne, quel que soit le nom de branche ou le titre reçu.
const uneLigne = (texte) => texte.replace(/\s+/g, ' ').trim();

/**
 * @typedef {{ titre: string, url: string, branche: string }} PR
 * @typedef {{
 *   rollback: boolean,
 *   resultats: { build: string, deploy: string, release: string, rollback: string },
 *   sha: string,
 *   servi: string,
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
    return c.resultats.rollback === 'success'
      ? `↩️ Rollback manuel effectué — ${court(c.servi)}`
      : `❌ Rollback manuel en échec${c.servi ? ` — ${court(c.servi)} servi` : ''}`;
  }
  const nom = uneLigne(c.pr?.branche || c.titreCommit || court(c.sha));
  if (c.resultats.deploy === 'success') {
    return `✅ ${nom} déployé — ${court(c.sha)}`;
  }
  let suite = ', version servie inconnue';
  if (c.rollbackEffectue) suite = ', rollback effectué';
  else if (c.resultats.deploy === 'skipped' || (c.servi && c.servi !== c.sha)) {
    suite = ', version précédente toujours servie';
  }
  return `❌ ${nom} : déploiement en échec${suite}`;
}

/** @param {Contexte} c */
export function composer(c) {
  const lignes = [
    c.pr
      ? `PR : ${uneLigne(c.pr.titre)} — ${c.pr.url}`
      : `PR : aucune (commit : ${uneLigne(c.titreCommit) || 'titre inconnu'})`,
    `Commit : ${c.sha || 'inconnu'}`,
    `Version servie par le Pi : ${c.servi || 'inconnue'}`,
    `Exécution : ${c.execution}`,
  ];
  if (!c.rollback && c.resultats.release === 'success') {
    lignes.push(`Release : ${c.depot}/releases/tag/deploy-${court(c.sha)}`);
  }
  return { subject: objet(c), textContent: `${lignes.join('\n')}\n` };
}

async function github(chemin) {
  const env = process.env;
  const reponse = await fetch(
    `${env.GITHUB_API_URL ?? 'https://api.github.com'}${chemin}`,
    {
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
  if (sha) {
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
  }
  return {
    rollback,
    resultats: {
      build: env.BUILD_RESULT ?? '',
      deploy: env.DEPLOY_RESULT ?? '',
      release: env.RELEASE_RESULT ?? '',
      rollback: env.ROLLBACK_RESULT ?? '',
    },
    sha: sha ?? '',
    servi,
    rollbackEffectue: env.ROLLBACK_EFFECTUE === 'true',
    pr,
    titreCommit,
    execution: `${depot}/actions/runs/${env.GITHUB_RUN_ID}`,
    depot,
  };
}

if (import.meta.main) {
  const mail = composer(await lireContexte());
  if (process.argv.includes('--a-blanc')) {
    console.log(`Objet : ${mail.subject}\n\n${mail.textContent}`);
  } else {
    const { NOTIFY_EMAIL_FROM: from, NOTIFY_EMAIL_TO: to } = process.env;
    console.log(
      JSON.stringify({ sender: { email: from }, to: [{ email: to }], ...mail }),
    );
  }
}
