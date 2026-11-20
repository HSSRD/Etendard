// Termine l'export web d'Expo (ADR 0015). Usage : node scripts/export-web.js <dossier>
// - Chaque <style> et <script> en ligne des pages devient un fichier de /_expo/static/, nommé par
//   l'empreinte de son contenu : la CSP du Caddyfile n'autorise que les fichiers du site ('self').
//   Un <style> garde son id sur le <link> : react-native-web retrouve ainsi sa feuille
//   (#react-native-stylesheet) et y ajoute ses règles par le CSSOM, que la CSP ne bloque pas.
// - Sans STYLEGUIDE=1, les pages /styleguide sont retirées (ADR 0003).
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Dossiers de /_expo/static/ des fichiers sortis des pages, par extension. */
const folders = { css: '_expo/static/css', js: '_expo/static/js/web' };

/**
 * Remplace les <style> et <script> en ligne de `html` par des liens vers des fichiers.
 * `write(ext, contenu)` enregistre un fichier et renvoie son URL.
 * @param {string} html
 * @param {(ext: 'css' | 'js', content: string) => string} write
 */
export const externalize = (html, write) =>
  html
    .replace(
      /<style([^>]*)>([\s\S]*?)<\/style>/g,
      (_, attributes, css) =>
        `<link rel="stylesheet" href="${write('css', css)}"${attributes}>`,
    )
    .replace(
      /<script((?:(?!\ssrc=)[^>])*)>([\s\S]+?)<\/script>/g,
      (_, attributes, js) =>
        `<script src="${write('js', js)}"${attributes}></script>`,
    );

/** Fichiers .html de `dir`, sous-dossiers compris. */
const pages = (/** @type {string} */ dir) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join(dir, file));

const main = (/** @type {string | undefined} */ dir) => {
  if (!dir) throw new Error('usage : node scripts/export-web.js <dossier>');
  if (process.env['STYLEGUIDE'] !== '1') {
    rmSync(path.join(dir, 'styleguide'), { recursive: true, force: true });
    rmSync(path.join(dir, 'styleguide.html'), { force: true });
  }
  for (const folder of Object.values(folders)) {
    mkdirSync(path.join(dir, folder), { recursive: true });
  }
  /** URL des fichiers déjà écrits : chaque page répète les mêmes blocs. */
  const written = new Set();
  /** @type {(ext: 'css' | 'js', content: string) => string} */
  const write = (ext, content) => {
    const hash = createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
    const url = `/${folders[ext]}/inline-${hash}.${ext}`;
    if (!written.has(url)) writeFileSync(path.join(dir, url), content);
    written.add(url);
    return url;
  };
  for (const page of pages(dir)) {
    writeFileSync(page, externalize(readFileSync(page, 'utf8'), write));
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv[2]);
}
