const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const PathsPlugin = require("tsconfig-paths-webpack-plugin").default;
const ESLintPlugin = require("eslint-webpack-plugin");

const { createSveltePreprocessor } = require("./svelte.config.js");

const SRC_FOLDER = path.resolve(__dirname, "src/");
const DIST_FOLDER = path.resolve(__dirname, "dist/");
const ASSETS_FOLDER = path.resolve(__dirname, "public/");

const ENTRY = path.resolve(SRC_FOLDER, "index.ts");

module.exports = {
  entry: ENTRY,
  resolve: {
    alias: {
      svelte: path.dirname(require.resolve("svelte/package.json")),
    },
    extensions: [".mjs", ".js", ".ts", ".svelte"],
    mainFields: ["svelte", "browser", "module", "main"],
    plugins: [
      new PathsPlugin({
        extensions: [".mjs", ".js", ".ts", ".svelte"],
      }),
    ],
  },
  output: {
    path: path.join(__dirname, "/dist"),
    filename: "[name].js",
    chunkFilename: "[name].[id].js",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.svelte$/,
        loader: "svelte-loader",
        options: {
          compilerOptions: {
            dev: true,
            enableSourcemap: true,
          },
          emitCss: false,
          preprocess: createSveltePreprocessor(),
          hotReload: true,
          hotOptions: {
            noPreserveState: true,
            noReload: false,
            optimistic: false,
          },
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        //Required to prevent errors from Svelte on Webpack 5+
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  devServer: {
    client: {
      logging: "info",
      overlay: true,
      progress: true,
    },
    static: {
      directory: ASSETS_FOLDER,
      publicPath: "/public/",
      watch: true,
      serveIndex: false,
    },
    devMiddleware: {
      index: "index.html",
      publicPath: "/",
    },
    compress: false,
    port: 65535,
    open: false,
    historyApiFallback: true,
    https: false,
    hot: true,
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[contenthash].[name].css",
    }),
    new HtmlWebpackPlugin({
      template: "public/index.html",
      title: "Scratch That",
    }),
    new ESLintPlugin({
      failOnError: true,
      failOnWarning: false,
      emitError: true,
      emitWarning: true,
    }),
  ],
  experiments: {
    topLevelAwait: true
  },
  mode: process.env.NODE_ENV || "production",
  devtool: "source-map",
};
