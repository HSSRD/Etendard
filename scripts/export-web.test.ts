import { describe, expect, it } from 'vitest';
import { externalize } from './export-web.js';

describe('externalize', () => {
  const files: [string, string][] = [];
  const write = (ext: 'css' | 'js', content: string) => {
    files.push([ext, content]);
    return `/${ext}/${files.length}.${ext}`;
  };

  it('sort styles et scripts en ligne, garde leurs attributs et les scripts à src', () => {
    files.length = 0;
    const html = [
      '<head><style id="react-native-stylesheet">.a{color:red}</style>',
      '<script defer="" src="/entry.js"></script></head>',
      '<body><script id="_R_">globalThis.x=true;</script></body>',
    ].join('');
    expect(externalize(html, write)).toBe(
      [
        '<head><link rel="stylesheet" href="/css/1.css" id="react-native-stylesheet">',
        '<script defer="" src="/entry.js"></script></head>',
        '<body><script src="/js/2.js" id="_R_"></script></body>',
      ].join(''),
    );
    expect(files).toEqual([
      ['css', '.a{color:red}'],
      ['js', 'globalThis.x=true;'],
    ]);
  });
});
