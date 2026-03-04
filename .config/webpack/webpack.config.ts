/**
 * Webpack configuration for the Grafana MongoDB datasource plugin.
 */
import type { Configuration } from 'webpack';
import { resolve } from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
// @ts-ignore — no type declarations available
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pluginJson = require('../../src/plugin.json');

const config = async (env: Record<string, string>): Promise<Configuration> => {
  const isProduction = env.production === 'true' || env.production === '';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-source-map',

    entry: {
      module: resolve(process.cwd(), 'src', 'module.ts'),
    },

    output: {
      path: resolve(process.cwd(), 'dist'),
      filename: '[name].js',
      library: {
        type: 'amd',
      },
      clean: isProduction,
    },

    externals: [
      function ({ request }, callback) {
        // Externalize react and all its subpath exports (jsx-runtime, jsx-dev-runtime)
        if (request && /^react(\/.*)?$/.test(request)) {
          return callback(undefined, request);
        }
        if (request && /^react-dom(\/.*)?$/.test(request)) {
          return callback(undefined, request);
        }
        callback();
      },
      'lodash',
      'jquery',
      'moment',
      'slate',
      'emotion',
      'prismjs',
      'slate-plain-serializer',
      '@grafana/slate-react',
      'react-redux',
      'redux',
      'rxjs',
      'react-router',
      'react-router-dom',
      'd3',
      'angular',
      '@grafana/data',
      '@grafana/e2e-selectors',
      '@grafana/runtime',
      '@grafana/ui',
    ],

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },

    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  decorators: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: false,
                  },
                },
                target: 'es2021',
              },
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.s[ac]ss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'img/[name][ext]',
            publicPath: `public/plugins/${pluginJson.id}/`,
            outputPath: './',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]',
            publicPath: `public/plugins/${pluginJson.id}/`,
            outputPath: './',
          },
        },
      ],
    },

    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'README.md', to: '.', noErrorOnMissing: true },
          { from: 'CHANGELOG.md', to: '.', noErrorOnMissing: true },
          { from: 'LICENSE', to: '.', noErrorOnMissing: true },
          { from: 'src/plugin.json', to: '.' },
          { from: 'src/img', to: 'img', noErrorOnMissing: true },
        ],
      }),
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: resolve(process.cwd(), 'tsconfig.json'),
        },
      }),
      new ESLintPlugin({
        extensions: ['ts', 'tsx'],
        lintDirtyModulesOnly: !isProduction,
      }),
      new ReplaceInFileWebpackPlugin([
        {
          dir: 'dist',
          files: ['plugin.json'],
          rules: [
            {
              search: '%VERSION%',
              replace: pluginJson.info.version,
            },
            {
              search: '%TODAY%',
              replace: new Date().toISOString().substring(0, 10),
            },
          ],
        },
      ]),
    ],
  };
};

export default config;
