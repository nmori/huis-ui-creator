/*
    Copyright 2016 Sony Corporation

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/// <reference path="../include/interfaces.d.ts" />

namespace Garage {
    export namespace Util {

        /**
         * @class IniParser
         * @brief INI ファイルのパーサー
         *
         * 以前使用していた node-ini (保守終了) と同じ文法・結果を返す。
         *  - [section]         : section をオブジェクトとして追加
         *  - [section][]       : section を配列とし、出現ごとに要素 (オブジェクト) を追加
         *  - [section][key]    : section[key] をオブジェクトとして追加
         *  - name=value        : 値は前後の空白を除いた文字列のまま (型変換・引用符の除去・行内コメントの除去はしない)
         *  - name[]=value      : 配列に追加
         *  - name[key]=value   : オブジェクトに追加
         *  - 上記に一致しない行 (; # // で始まるコメント行など) は無視する
         *  - プロトタイプ汚染を防ぐため、__proto__ / constructor / prototype という名前のセクション・パラメーターは無視する
         */
        export class IniParser {
            private static SECTION_KEY = /^\s*\[\s*([^\]]*)\s*\]\s*$/;
            private static SECTION_ARR = /^\s*\[\s*([^\]]*)\s*\]\[\]\s*$/;
            private static SECTION_OBJ = /^\s*\[\s*([^\]]*)\s*\]\[(\w+)\]\s*$/;
            private static PARAM_KEY = /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/;
            private static PARAM_ARR = /^\s*([\w\.\-\_]+)\[\]\s*=\s*(.*?)\s*$/;
            private static PARAM_OBJ = /^\s*([\w\.\-\_]+)\[(\w+)\]\s*=\s*(.*?)\s*$/;
            private static UNSAFE_NAMES = ["__proto__", "constructor", "prototype"];

            /**
             * プロトタイプ汚染につながる名前かどうか
             */
            private static isUnsafeName(...names: string[]): boolean {
                return names.some((name) => IniParser.UNSAFE_NAMES.indexOf(name) >= 0);
            }

            /**
             * obj が name という名前のプロパティを自身に持つかどうか (継承したプロパティは含まない)
             */
            private static has(obj: any, name: string): boolean {
                return Object.prototype.hasOwnProperty.call(obj, name);
            }

            /**
             * INI ファイルを読み込んでパースする
             * @param filePath {string} INI ファイルのパス
             * @return {any} パース結果
             */
            static parseFileSync(filePath: string): any {
                return IniParser.parse(fs.readFileSync(filePath, "utf8"));
            }

            /**
             * INI 形式の文字列をパースする
             * @param text {string} INI 形式の文字列
             * @return {any} パース結果
             */
            static parse(text: string): any {
                let result: any = {};
                // 現在のセクション (name が undefined の場合はトップレベル、type が "skip" の場合は無視するセクション)
                let section: { type?: string, name?: string, index?: number, key?: string } = {};
                // 現在のセクションでパラメーターを格納するオブジェクト
                let target = (): any => {
                    switch (section.type) {
                        case "arr":
                            if (!IniParser.has(result[section.name], String(section.index))) {
                                result[section.name][section.index] = {};
                            }
                            return result[section.name][section.index];
                        case "obj":
                            if (!IniParser.has(result[section.name], section.key)) {
                                result[section.name][section.key] = {};
                            }
                            return result[section.name][section.key];
                        default:
                            return result[section.name];
                    }
                };

                for (let line of text.split(/\r\n|\r|\n/)) {
                    let match: RegExpMatchArray;

                    // セクション
                    if ((match = line.match(IniParser.SECTION_KEY))) {
                        if (IniParser.isUnsafeName(match[1])) {
                            section = { type: "skip", name: match[1] };
                            continue;
                        }
                        section = { type: "key", name: match[1] };
                        if (!IniParser.has(result, section.name)) {
                            result[section.name] = {};
                        }
                    } else if ((match = line.match(IniParser.SECTION_ARR))) {
                        if (IniParser.isUnsafeName(match[1])) {
                            section = { type: "skip", name: match[1] };
                            continue;
                        }
                        let index = 0;
                        if (!IniParser.has(result, match[1])) {
                            result[match[1]] = [{}];
                        } else if (section.type === "arr" && section.name === match[1]) {
                            index = section.index + 1;
                        } else {
                            index = result[match[1]].length;
                        }
                        section = { type: "arr", name: match[1], index: index };
                    } else if ((match = line.match(IniParser.SECTION_OBJ))) {
                        if (IniParser.isUnsafeName(match[1], match[2])) {
                            section = { type: "skip", name: match[1] };
                            continue;
                        }
                        if (!IniParser.has(result, match[1])) {
                            result[match[1]] = {};
                            result[match[1]][match[2]] = {};
                        }
                        section = { type: "obj", name: match[1], key: match[2] };
                    }

                    // パラメーター
                    if (section.type === "skip") {
                        continue;
                    }
                    if ((match = line.match(IniParser.PARAM_KEY))) {
                        if (IniParser.isUnsafeName(match[1])) {
                            continue;
                        }
                        if (section.name === undefined) {
                            result[match[1]] = match[2];
                        } else {
                            target()[match[1]] = match[2];
                        }
                    } else if ((match = line.match(IniParser.PARAM_ARR))) {
                        if (IniParser.isUnsafeName(match[1])) {
                            continue;
                        }
                        let values = section.name === undefined ? result : target();
                        if (!IniParser.has(values, match[1])) {
                            values[match[1]] = [];
                        }
                        values[match[1]].push(match[2]);
                    } else if ((match = line.match(IniParser.PARAM_OBJ))) {
                        if (IniParser.isUnsafeName(match[1], match[2])) {
                            continue;
                        }
                        let values = section.name === undefined ? result : target();
                        if (!IniParser.has(values, match[1])) {
                            values[match[1]] = {};
                        }
                        values[match[1]][match[2]] = match[3];
                    }
                }
                return result;
            }
        }
    }
}
