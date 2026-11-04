import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Guarda-corpo dos SDKs Mitra — NUNCA desabilitar estas regras.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mitra-sdk',
              allowImportNames: ['manageUserAccessMitra', 'listProjectUsersMitra'],
              message:
                'mitra-sdk é exclusiva de scripts de backend — em telas use mitra-interactions-sdk (mesmos nomes de função). Única exceção permitida: manageUserAccessMitra/listProjectUsersMitra em tela de gestão de usuários restrita a dev, com avisos visíveis na tela.',
            },
            {
              name: 'mitra-interactions-sdk',
              importNames: [
                'listRecordsMitra',
                'getRecordMitra',
                'createRecordMitra',
                'updateRecordMitra',
                'patchRecordMitra',
                'deleteRecordMitra',
                'createRecordsBatchMitra',
              ],
              message:
                'CRUD REST NUNCA em telas (retorna 403 para usuários business). Use Server Functions via executeServerFunctionMitra.',
            },
          ],
        },
      ],
    },
  },
])
