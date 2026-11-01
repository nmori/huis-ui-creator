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

        // @zip.js/zip.js (Electron renderer では nodeIntegration 経由で読み込む)
        const zipjs: typeof import("@zip.js/zip.js") = require("@zip.js/zip.js");
        // Web Worker は使用しない (file:// からの worker 読み込みを避ける)
        zipjs.configure({ useWebWorkers: false });

        export class ZipManager {

            /**
             * 指定ファイルをzip圧縮する
             * @param files {string[]} 対象ファイル（srcRootからの相対パス）
             * @param srcRoot {string} filesの基準となるフォルダパス（フルパス）
             * @param dstFile {string} 出力するファイル名（フルパス）
             */
            static compress(files: string[], srcRoot: string, dstFile: string): CDP.IPromise<void> {
                console.log("start zip: " + srcRoot + " -> " + dstFile);
                let df = $.Deferred<void>();
                let promise = CDP.makePromise(df);

                if (!files || files.length <= 0) return promise;

                let writer = new zipjs.ZipWriter(new zipjs.Uint8ArrayWriter());

                let addFiles = async (): Promise<boolean> => {
                    for (let file of files) {
                        let filePath = path.resolve(srcRoot, file);
                        let fileData: Buffer;
                        try {
                            fileData = fs.readFileSync(filePath);
                        } catch (e) {
                            console.error("failed to read a file: " + filePath);
                            console.error(e);
                            df.reject("failed to read a file: " + filePath);
                            return false;
                        }
                        await writer.add(file.replace(/\\/g, "/"), new zipjs.Uint8ArrayReader(fileData));
                    }
                    return true;
                };

                addFiles()
                    .then(async (succeeded) => {
                        if (!succeeded) {
                            return;
                        }
                        let zipData = await writer.close();
                        ZipManager.saveDataToFile(zipData, dstFile)
                            .done(() => {
                                df.resolve()
                            }).fail((err) => {
                                df.reject(err)
                            });
                    })
                    .catch((err) => {
                        console.error("create zip errored: " + err);
                        alert("create zip errored");
                        df.reject();
                    });

                return promise;
            }

            /**
             * バイナリーデータをファイルに出力
             * @param data {Uint8Array}
             * @param dstFile {string} 出力ファイル名（フルパス）
             */
            private static saveDataToFile(data: Uint8Array, dstFile: string): CDP.IPromise<void> {
                let df = $.Deferred<void>();
                let promise = CDP.makePromise(df);

                let dir = path.dirname(dstFile);
                if (!fs.existsSync(dir)) {
                    try {
                        console.log("mkdirs: " + dir);
                        fs.mkdirsSync(dir);
                    } catch (e) {
                        console.error("failed to mkdirs: " + dir);
                        console.error(e);
                        df.reject("failed to mkdirs: " + dir);
                        return promise;
                    }
                }

                try {
                    fs.writeFileSync(dstFile, data);
                    console.log("create file: " + dstFile);
                    df.resolve();
                } catch (e) {
                    console.error("failed to create file: " + dstFile);
                    df.reject();
                }

                return promise;
            }


            /**
             * zipファイルを解凍
             * @param zipFile {string} zipファイル（フルパス）
             * @param dstDir {string} 解凍先フォルダ（フルパス）
             */
            static decompress(zipFile: string, dstDir: string): CDP.IPromise<void> {
                console.log("start unzip: " + zipFile + " -> " + dstDir);
                let df = $.Deferred<void>();
                let promise = CDP.makePromise(df);

                let fileData: Buffer;
                try {
                    fileData = fs.readFileSync(zipFile);
                } catch (e) {
                    console.error("failed to read a zip file: " + zipFile);
                    console.error(e);
                    df.reject(e, ImportManager.createRemoteFileErrorMessage());
                    return promise;
                }

                let reader = new zipjs.ZipReader(new zipjs.Uint8ArrayReader(fileData));
                reader.getEntries()
                    .then((entries) => {
                        if (entries.length <= 0) {
                            console.log("nothing to decompress");
                            df.resolve();
                            return;
                        }
                        console.log("find files: " + entries.length);

                        let saveTasks = new Array<JQueryPromise<void>>(entries.length);

                        for (let i = 0; i < entries.length; i++) {
                            let entry = entries[i];

                            saveTasks[i] = ZipManager.decompressOneFile(entry, dstDir);
                        }

                        $.when.apply($, saveTasks)
                            .then(() => {
                                console.log("finish decompress");
                                df.resolve();
                            }).fail((err) => {
                                console.log("failed to decompress: " + err);
                                df.reject(err, ImportManager.createRemoteFileErrorMessage());
                            });
                    }, (error) => {
                        // hsrcファイル読み込み失敗
                        console.error("failed to read the hsrc file" + error);
                        df.reject(error, ImportManager.createRemoteFileErrorMessage());
                    })
                    .finally(() => {
                        reader.close();
                    });

                return promise;
            }

            /**
             * zipエントリーの1ファイルを出力する
             * @param entry {zip.Entry} 出力するzipエントリー
             * @param dstDir {string} 出力先の基準フォルダ
             */
            private static decompressOneFile(entry: import("@zip.js/zip.js").Entry, dstDir: string): CDP.IPromise<void> {
                let df = $.Deferred<void>();
                let promise = CDP.makePromise(df);

                if (entry.directory) {
                    console.log("skip decompress: " + entry.filename);
                    df.resolve();
                    return promise;
                }

                // Replacement of next line assumes that each file path in zip doesn't contain "\".
                // Note that this assumption VIOLATE zip file format.
                let fileName = entry.filename.replace(/\\/g, "/");
                let dstFile = path.join(dstDir, fileName);

                // 解凍先フォルダの外に出るパス ("../" や絶対パス) は出力しない (Zip Slip 対策)
                let relativePath = path.relative(path.resolve(dstDir), path.resolve(dstFile));
                if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
                    console.error("invalid entry path: " + entry.filename);
                    df.reject("invalid entry path: " + entry.filename);
                    return promise;
                }

                (entry as import("@zip.js/zip.js").FileEntry).getData(new zipjs.Uint8ArrayWriter())
                    .then((data) => {
                        ZipManager.saveDataToFile(data, dstFile)
                            .done(() => {
                                console.log("succeeded to decompress: " + fileName);
                                df.resolve();
                            }).fail(() => {
                                console.error("failed to decompress: " + fileName);
                                df.reject();
                            });
                    }, (err) => {
                        console.error("failed to decompress: " + fileName + " " + err);
                        df.reject();
                    });

                return promise;
            }
        }
    }
}
