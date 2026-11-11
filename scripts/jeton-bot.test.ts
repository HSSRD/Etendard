import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { hostsYml, installationToken, jwt, PERMISSIONS } from './jeton-bot.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('jwt', () => {
  test('signé en RS256 par la clé de l’App, valable 9 minutes', () => {
    const [header = '', payload = '', signature = ''] = jwt(
      'Iv23li',
      privateKey,
      1000,
    ).split('.');
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(payload)).toEqual({ iat: 940, exp: 1540, iss: 'Iv23li' });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });
});

describe('installationToken', () => {
  test('demande un jeton limité au repo, sans permission workflows', async () => {
    let requete: { url: string; init: RequestInit } | undefined;
    const token = await installationToken('42', 'le-jwt', async (url, init) => {
      requete = { url: String(url), init: init ?? {} };
      return Response.json({ token: 'ghs_test' }, { status: 201 });
    });
    expect(token).toBe('ghs_test');
    expect(requete?.url).toBe(
      'https://api.github.com/app/installations/42/access_tokens',
    );
    expect(requete?.init.method).toBe('POST');
    expect(requete?.init.headers).toMatchObject({
      Authorization: 'Bearer le-jwt',
    });
    expect(JSON.parse(String(requete?.init.body))).toEqual({
      repositories: ['Etendard'],
      permissions: PERMISSIONS,
    });
    expect(PERMISSIONS).not.toHaveProperty('workflows');
    expect(PERMISSIONS).not.toHaveProperty('administration');
  });

  test('un refus de GitHub arrête le script avec son message', async () => {
    await expect(
      installationToken('42', 'le-jwt', async () =>
        Response.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    ).rejects.toThrow('GitHub a refusé le jeton (401)');
  });
});

describe('hostsYml', () => {
  test('configuration gh multi-comptes du bot, lue telle quelle par gh 2.103', () => {
    expect(hostsYml('ghs_x')).toBe(
      [
        'github.com:',
        '    users:',
        '        hssrd-bot[bot]:',
        '            oauth_token: ghs_x',
        '    git_protocol: https',
        '    oauth_token: ghs_x',
        '    user: hssrd-bot[bot]',
        '',
      ].join('\n'),
    );
  });
});
