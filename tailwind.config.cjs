/**
 * Root Tailwind config for monorepo tooling (vitest/typedoc/etc.)
 * Points Tailwind at the client app sources so tools running
 * from the repository root don't emit the "content missing" warning.
 */
module.exports = {
  content: [
    './apps/client/index.html',
    './apps/client/src/**/*.{js,ts,jsx,tsx,html}',
  ],
};
