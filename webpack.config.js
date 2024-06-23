const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const sveltePreprocess = require('svelte-preprocess');

const lib = {
  entry: "./lib/mfx.ts",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  module: {
    rules: [
      { test: /\.glsl$/, use: "raw-loader" },
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  performance: {
    maxEntrypointSize: 1024000,
    maxAssetSize: 1024000
  }
};

const demo = {
  entry: "./demo/demo.ts",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "demo.js",
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
      svelte: path.resolve("node_modules", "svelte/src/runtime"),
    },
    extensions: [".js", ".ts", ".svelte"],
    mainFields: ["svelte", "browser", "module", "main"],
    conditionNames: ["svelte", "browser", "import"],
    fullySpecified: false,
  },
  plugins: [new HtmlWebpackPlugin({ template: "./demo/index.html" })],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  performance: {
    hints: false,
    maxEntrypointSize: 1024000,
  }
};

module.exports = [lib, demo];
