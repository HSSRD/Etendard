// Émet un jeton d'installation de la GitHub App `hssrd-bot` (ADR 0008) et le donne au `gh` du
// compte Windows des agents. Tourne sous le compte de Flo, seul à lire la clé privée de l'App :
// le compte des agents ne reçoit que le jeton, valable une heure. N'affiche jamais le jeton.
// Usage : node jeton-bot.js <client ID> <installation ID> <clé .pem> <GH_CONFIG_DIR des agents>
// Flo en exécute une copie relue, rangée dans son profil (infra/agents/README.md).
import { spawnSync } from 'node:child_process';
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = 'https://api.github.com';

/** Permissions du jeton : celles de l'App, sans `workflows` (ADR 0008). */
export const PERMISSIONS = {
  actions: 'read',
  checks: 'read',
  contents: 'write',
  issues: 'write',
  metadata: 'read',
  pull_requests: 'write',
  statuses: 'read',
};

const base64url = (/** @type {string | Buffer} */ data) =>
  Buffer.from(data).toString('base64url');

/**
 * JWT de l'App (RS256, 9 minutes, `iat` reculé d'une minute contre le décalage d'horloge).
 * @param {string} clientId
 * @param {string} pem
 * @param {number} now secondes depuis l'epoch
 */
export const jwt = (clientId, pem, now) => {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: clientId }),
  );
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${payload}`),
    pem,
  );
  return `${header}.${payload}.${base64url(signature)}`;
};

/**
 * Demande un jeton d'installation limité au repo Etendard et à PERMISSIONS.
 * @param {string} installationId
 * @param {string} appJwt
 * @param {typeof fetch} [request]
 * @returns {Promise<string>}
 */
export const installationToken = async (
  installationId,
  appJwt,
  request = fetch,
) => {
  const response = await request(
    `${API}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        repositories: ['Etendard'],
        permissions: PERMISSIONS,
      }),
    },
  );
  if (!response.ok) {
    // Le corps d'une erreur ne contient pas de jeton : il explique le refus.
    throw new Error(
      `GitHub a refusé le jeton (${response.status}) : ${await response.text()}`,
    );
  }
  /** @type {{ token: string }} */
  const { token } = await response.json();
  return token;
};

const main = async () => {
  const [clientId, installationId, keyPath, ghConfigDir] =
    process.argv.slice(2);
  if (!ghConfigDir) {
    throw new Error(
      'Usage : node jeton-bot.js <client ID> <installation ID> <clé .pem> <GH_CONFIG_DIR des agents>',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const token = await installationToken(
    installationId,
    jwt(clientId, readFileSync(keyPath, 'utf8'), now),
  );
  // `gh` écrit lui-même sa configuration dans le dossier des agents ; le jeton passe par stdin.
  // Un GH_TOKEN hérité ferait refuser `gh auth login` : il est retiré.
  const env = { ...process.env, GH_CONFIG_DIR: ghConfigDir };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  const login = spawnSync(
    'gh',
    [
      'auth',
      'login',
      '--hostname',
      'github.com',
      '--git-protocol',
      'https',
      '--insecure-storage',
      '--with-token',
    ],
    {
      input: token,
      env,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  if (login.status !== 0) throw new Error('gh auth login a échoué.');
  console.log(`Jeton hssrd-bot renouvelé dans ${ghConfigDir}.`);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
