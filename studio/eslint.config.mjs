import studio from '@sanity/eslint-config-studio'

export default [
  ...studio,
  {
    // The `scripts/**` one-off migrations run under `sanity exec` in Node, not
    // in the Studio bundle, so they need Node globals declared. Listed inline
    // rather than pulling in `globals` as a dependency, and kept as globals
    // (rather than disabling `no-undef`) so real typos are still caught.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
]
