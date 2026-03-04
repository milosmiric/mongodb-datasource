/**
 * Jest configuration for the MongoDB datasource plugin.
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.{test,spec}.{ts,tsx}'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
          target: 'es2021',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(ol|@grafana|rxjs|uuid|d3|d3-interpolate|d3-color|internmap|delaunator|robust-predicates))',
  ],
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|gif)$': '<rootDir>/src/testdata/fileMock.js',
    '^monaco-editor$': '<rootDir>/src/testdata/monacoMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/.config/jest-setup.js'],
};
