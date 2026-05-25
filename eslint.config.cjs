module.exports = [
  {
    ignores: [
      'build/**',
      'build-43-44/**',
      'dist/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        imports: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        TextDecoder: 'readonly',
        Uint8Array: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
];
