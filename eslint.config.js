import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Vendor-specific data and push SDKs are not allowed in V2 (see docs/product/decisions.md).
const vendorBan = {
  group: ['@supabase/*', '@neondatabase/*', 'react-onesignal'],
  message: 'V2 uses plain Postgres through the API. No vendor-specific data or push SDKs.',
};

// Lane boundaries: packages never import apps, and apps never import other apps.
const appPackages = [
  '@qc/api',
  '@qc/worker',
  '@qc/user-app',
  '@qc/admin-app',
  '@qc/console',
  '@qc/poster-renderer',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      // One-off store asset generator scripts, run by hand (tools/store-assets/README.md).
      'tools/store-assets/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { patterns: [vendorBan] }],
    },
  },
  {
    // Node scripts run by hand or from package.json (scripts/*.mjs).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            vendorBan,
            {
              group: appPackages,
              message: 'Packages must not import apps. Move shared code into a package.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            vendorBan,
            {
              group: appPackages,
              message: 'Apps must not import other apps. Share through a package or the API.',
            },
          ],
        },
      ],
    },
  },
);
