import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import typescript from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Airbnb base rules (legacy format via FlatCompat bridge)
  ...compat.extends('airbnb-base'),
  // Custom overrides — applied on top of Airbnb
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
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
          useAliases: true,
        },
      },
    },
    rules: {
      // @typescript-eslint v8 recommended rules
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
      '@typescript-eslint/indent': 'off',
      'quotes': ['error', 'single', { avoidEscape: true }],
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Airbnb overrides for Node.js backend
      'import/prefer-default-export': 'off',
      'import/extensions': ['error', 'ignorePackages', { ts: 'never' }],
      'no-console': 'off',
      'class-methods-use-this': 'off',
      // Replace Airbnb JS rules with TypeScript-aware equivalents
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',
    },
  },
]

