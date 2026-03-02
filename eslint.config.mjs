import typescript from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      // Line length
      'max-len': ['error', { code: 144, ignoreUrls: true, ignoreStrings: false, ignoreTemplateLiterals: false }],
      // Always require semicolons
      'semi': ['error', 'always'],
      '@typescript-eslint/semi': 'off',
      // Trailing commas for multi-line
      'comma-dangle': ['error', 'always-multiline'],
      // Consistent spacing
      'indent': ['error', 2],
      'quotes': ['error', 'single', { avoidEscape: true }],
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
