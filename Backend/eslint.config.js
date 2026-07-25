import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': [
        'off',
      ],
      'no-console': 'off',
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'scratch/', 'scripts/'],
  },
];
