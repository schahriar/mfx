const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const sveltePreprocess = require('svelte-preprocess');
const CircularDependencyPlugin = require('circular-dependency-plugin');

const lib = {
  entry: "./lib/mfx.ts",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    library: {
      name: "MFX",
      type: "umd",
    },
  },
  module: {
    rules: [
      { test: /\.glsl$/, use: "raw-loader" },
      {
        test: /\.ts|.js?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            configFile: path.resolve(__dirname, 'tsconfig.json')
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fullySpecified: false,
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        keep_classnames: true,
      }
    })],
  },
  performance: {
    maxEntrypointSize: 1024000,
    maxAssetSize: 1024000
  }
};

const tests = {
  entry: "./tests/environment/router.ts",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "test.js",
  },
  module: {
    rules: [
      { test: /\.glsl$/, use: "raw-loader" },
      {
        test: /\.svelte$/,
        loader: 'svelte-loader',
        options: {
          preprocess: sveltePreprocess({
            typescript: true
          })
        },
      },
      {
        test: /\.(ts|js)?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /node_modules\/.*\.js$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  resolve: {
    alias: {
      mfx: path.resolve(__dirname, './lib/mfx'),
      svelte: path.resolve("node_modules", "svelte/src/runtime"),
    },
    extensions: [".js", ".ts", ".svelte"],
    mainFields: ["svelte", "browser", "module", "main"],
    conditionNames: ["svelte", "browser", "import"],
    fullySpecified: false,
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./tests/environment/index.html" }),
    new CircularDependencyPlugin()
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        keep_classnames: true
      }
    })],
  },
  performance: {
    hints: false,
    maxEntrypointSize: 1024000,
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'samples'),
    },
    historyApiFallback: true,
    compress: true,
  },
};

module.exports = [lib, ...process.env["NODE_ENV"] !== "production" ? [tests] : []];
