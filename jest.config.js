// Tests run through the same Babel setup as the app, including the
// React Compiler that app.json turns on (experiments.reactCompiler).
const preset = require('jest-expo/jest-preset');

const sourceFiles = '\\.[jt]sx?$';
const [babelJest, babelOptions] = preset.transform[sourceFiles];

module.exports = {
  ...preset,
  transform: {
    ...preset.transform,
    [sourceFiles]: [
      babelJest,
      { ...babelOptions, caller: { ...babelOptions.caller, supportsReactCompiler: true } },
    ],
  },
  moduleNameMapper: { ...preset.moduleNameMapper, '^@/(.*)$': '<rootDir>/$1' },
};
