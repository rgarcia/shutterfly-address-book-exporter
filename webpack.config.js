const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    background: './src/background.js',
    content: './src/content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js'
  },
  devtool: 'source-map',
  target: 'web',
};