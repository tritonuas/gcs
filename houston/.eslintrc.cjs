module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/recommended',
    'plugin:jsdoc/recommended-typescript-error',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'react', 'react-hooks', 'jsdoc'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // Make an unused variable a warning, and
    // Ignore unused variable warning if the
    // variable begins with underscore
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn", // or "error"
      { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],

    // suppress errors that require React to be imported (not necessary in React versions >= v17.0)
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
  },
  
  // automatically detect react version
  "settings": {
    "react": {
      "version": "detect"
    }
  },  
}
