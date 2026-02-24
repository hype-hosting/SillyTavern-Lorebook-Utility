import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';

const dirname = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);

export default {
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.html$/,
        use: 'html-loader',
      },
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
};
