const webpack = require('webpack')
const os = require('os')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin") 
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AddAssetHtmlPlugin =require("add-asset-html-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin')
const HappyPack = require('happypack')
const happyThreadPool = HappyPack.ThreadPool({size: os.cpus().length}); // 指定线程池个数
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const { isProduction } = require('./common/const')
const { resolvePath, getEnv } = require('./common/utils')
const ENV = require('../config/env.js')
const { DllConfig, isDll, isShowProgress, isCache } = require('../config/index')
/**
 * css的load处理
 * @param {String} lang less，scss
 */
function styleLoaders (lang) {
  const loaders = [
    {
      loader: 'css-loader',
    },
    {
      loader: 'postcss-loader',
      options: {
        config: {
          path: resolvePath('postcss.config.js')
        }
      }
    }
  ]
  if (lang === 'scss') {
    loaders.push({
      loader: 'sass-loader',
      options: {
        indentedSyntax: false,
      }
    })
  }
  if (lang === 'less') {
    loaders.push({
      loader: 'less-loader',
    })
  }
  if (isProduction) {
    loaders.unshift(MiniCssExtractPlugin.loader)
    isCache && loaders.unshift('cache-loader')
    return loaders
  } else {
    return ['vue-style-loader'].concat(loaders) // vue-style-loader热跟新
  }
}
const getDllReferenceArr = () => {
  let arr = []
  Object.keys(DllConfig).forEach(name => {
    let plugin = new webpack.DllReferencePlugin({
      manifest: resolvePath(`dll/${name}.manifest.json`),
      name: name,
      sourceType: "var"
    })
    arr.push(plugin)
  })
  return arr
}
const baseConfig = {
  entry: {
    app: ['@babel/polyfill', 'react-hot-loader/patch', resolvePath('src/index.js')] // 入口
  },
  output: {
    // path: resolve('dist'), // 出口路径
    filename: '[name].[hash:10].js', // 输出文件名
    chunkFilename: "[id].[hash:10].js", // 公共代码
  },
  resolve: {
    extensions: ['.js', '.jsx'], // 扩展名
    alias: {
      '@': resolvePath('src'),
      'assets': resolvePath('src/assets'),
    },
    modules: [resolvePath('node_modules')]
  },
  plugins: [
    // 清除之前打包的
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*'],
    }),
    new CopyWebpackPlugin(
      [
        { from: resolvePath('src/static'), to: resolvePath('dist/static')}
      ]
    ),
       // 注入环境变量
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(ENV[getEnv()])
    }),
    // 进度条
    isShowProgress ?  new webpack.ProgressPlugin() :  new ProgressBarPlugin(),
    new FriendlyErrorsWebpackPlugin(),
    new HappyPack({
      id: 'babel',
      loaders: isCache ? ['cache-loader', 'babel-loader?cacheDirectory'] : ['babel-loader'],
      threadPool: happyThreadPool,
      verbose: true,
    }),
    // css抽离
    new MiniCssExtractPlugin({
      filename: `css/[name].css?[hash]`,
    }),
    new HtmlWebpackPlugin({
      template: resolvePath('src/index.html'),
      filename: 'index.html',
      minify: { // 优化
        removeAttributeQuotes: true, // 删除双引号
        collapseWhitespace: true, // 变成一行
        html5: true,
        preserveLineBreaks:false,
        minifyCSS:true,
        minifyJS:true,
        removeComments:false
      },
    }),
  ],
  module: {
    rules: [
      {
        test: /\.jsx$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      // {
      //   enforce: 'pre',
      //   test: /\.(js|jsx)$/,
      //   loader: 'eslint-loader',
      //   exclude: /node_modules/,
      //   options: {
      //     formatter: require('eslint-friendly-formatter')
      //   }
      // },
      { 
        test: /\.js$/,
        use: 'happypack/loader?id=babel',
        exclude: /node_modules/,
        include:[resolvePath('src')]
      },
      { test: /\.css$/, use: styleLoaders() },
      { test: /\.scss$/, use: styleLoaders('scss') },
      { test: /\.less$/, use: styleLoaders('less') },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        include: resolvePath('src'),
        use: [
            {
                loader: 'url-loader',
                options: { 
                  limit: 20240,
                  name: 'images/[name]-[hash:5].[ext]',
                  publicPath: '/'
                },
            },
        ],
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'media/[name]-[hash:5].min.[ext]',
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'font/[name]-[hash:5].[ext]',
          publicPath: '/' // 处理文件文字引用
        }
      }
    ]
  },
}
// 是否开启Dll
if (isDll) {
  baseConfig.plugins.push(...getDllReferenceArr())
  baseConfig.plugins.push(
    new AddAssetHtmlPlugin({
      filepath: resolvePath('dll/*.dll.js'), // 需要添加的第三方文件夹
      hash: true,
      typeOfAsset: "js",
      outputPath:'./dll',
      publicPath: './dll'
    }),
  )
}

module.exports = baseConfig
