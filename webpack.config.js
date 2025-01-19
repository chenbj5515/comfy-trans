import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';
import Dotenv from 'dotenv-webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    mode: 'development',
    devtool: 'source-map',
    entry: {
        content: './src/content/content.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true
    },
    optimization: {
        minimize: false,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    chrome: "88"
                                }
                            }]
                        ]
                    }
                }
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { 
                    from: './src/manifest.json',
                    to: 'manifest.json',
                    transform(content) {
                        const manifest = JSON.parse(content);
                        if (!manifest.content_security_policy) {
                            manifest.content_security_policy = {
                                extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
                            };
                        }
                        return JSON.stringify(manifest, null, 2);
                    }
                },
            ]
        }),
        new Dotenv({
            systemvars: true
        })
    ],
    resolve: {
        extensions: ['.js'],
        fallback: {
            "path": false,
            "fs": false
        }
    }
}; 