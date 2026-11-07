// Règles d'architecture exécutables (ADR 0005).
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'pas-de-cycle',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'composant-sans-page',
      comment: 'Un composant ne dépend jamais d’une page.',
      severity: 'error',
      from: { path: '^src/components/' },
      to: { path: '^src/pages/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
