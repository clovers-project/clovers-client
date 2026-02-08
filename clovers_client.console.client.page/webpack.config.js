const path = require("path");
const HTMLWebpackPlugin = require("html-webpack-plugin");


module.exports = {
    mode:"production",
    entry:"./src/index.ts",
    resolve:{extensions: ['.ts', '.js'],},   
    output:{path:path.resolve(__dirname,"dist"), filename:"bundle.js",clean: true,},
    module:{rules :[
        {test:/\.ts$/, use:"ts-loader", exclude:/node_modules/,},
        {test:/\.css$/, use:["style-loader","css-loader"], exclude:/node_modules/,},
    ]},
    plugins:[
        new HTMLWebpackPlugin({template:"./src/index.html"}),
    ]
}