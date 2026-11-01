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

        export interface ElectronOpenFileDialogOptions {
            title?: string;
            defaultPath?: string;
            filters?: {
                name: string;
                extensions: string[];
            }[];
            [x: string]: any;
        }

        export interface ElectronSaveFileDialogOptions {
            title?: string;
            defaultPath?: string;
            filters?: {
                name: string;
                extensions: string[];
            }[];
        }

        export interface ElectronMessageBoxOptions {
            /**
             * Can be "none", "info" or "warning".
             */
            type?: string;
            /**
             * Texts for buttons.
             */
            buttons?: string[];
            /**
             * Title of the message box (some platforms will not show it).
             */
            title?: string;
            /**
             * Contents of the message box.
             */
            message?: string;
            /**
             * Extra information of the message.
             */
            detail?: string;
            /*
             * return velue when no button cliecked but thr dialog window closed
             */
            cancelId?: number;
            icon?: any;
        }

        /**
         * @class ElectronDialog
         * @brief Electron のダイアログを扱うための wrapper クラス
         */
        export class ElectronDialog {
            private _dialogOwner: ElectronShim.DialogOwner = "none";
            private _dialog = ElectronShim.dialog;
            private _enabled = true;
            constructor() {
                this._resetElectronDialog();
            }

            /**
             * ファイルオープンダイアログを開く
             *
             * @param options {ElectronOpenFileDialogOptions} ファイルオープンダイアログのオプション
             * @param callback {Function} ダイアログを開いた後に呼び出されるコールバック関数 (キャンセル時は undefined)
             */
            showOpenFileDialog(options?: ElectronOpenFileDialogOptions, callback?: (fileNames: string[]) => void): void {
                if (!this._enabled) {
                    return;
                }
                this._resetElectronDialog();
                this._dialog.showOpenDialog(this._dialogOwner, options || {})
                    .then((fileNames) => {
                        if (callback) {
                            callback(fileNames);
                        }
                    });
            }

            /**
             * ファイル保存ダイアログを開く
             *
             * @param options {ElectronSaveFileDialogOptions} ファイル保存ダイアログのオプション
             * @param callback {Function} ダイアログを開いた後に呼び出されるコールバック関数 (キャンセル時は undefined)
             */
            showSaveFileDialog(options?: ElectronSaveFileDialogOptions, callback?: (fileName: string) => void): void {
                if (!this._enabled) {
                    return;
                }
                this._resetElectronDialog();
                this._dialog.showSaveDialog(this._dialogOwner, options || {})
                    .then((fileName) => {
                        if (callback) {
                            callback(fileName);
                        }
                    });
            }

            /**
             * メッセージダイアログを開く
             *
             * @param options {ElectronSaveFileDialogOptions} ファイル保存ダイアログのオプション
             * @param callback {Function} ダイアログを開いた後に呼び出されるコールバック関数
             * @return {number} クリックされたボタンのindex。
             *     callbackが指定されている時、もしくはDialogがDisableされている時にはundefinedを返す。
             */
            showMessageBox(options?: ElectronMessageBoxOptions, callback?: (response: any) => void): number {
                if (!this._enabled) {
                    return undefined;
                }
                this._resetElectronDialog();
                return this._showMessageBox(this._dialogOwner, options, callback);
            }

            /**
             * Darwin環境において、HUISと切断された際のメッセージダイアログを開く。
             * このメソッドはそれ以外のメッセージ表示の際には使わない事。
             *
             * Darwin環境におけるElectronのダイアログは以下の点でWindows環境と異なる。
             * そのWorkaroundとして本メソッドは存在する。
             * ・非同期Dialogの表示中に同期Dialogを表示しようとした場合、非同期ダイアログのコールバックが呼ばれない
             * ・非同期Dialogの表示中に非同期Dialogを表示しようとした場合、2回目以降の呼び出しが正常に処理されない
             * そのため、Splashクラスにおける切断検知関数中で、非同期ダイアログの表示中にも本メソッドを表示されるまで繰り返し呼ぶことで
             * 切断ダイアログを表示させる事にしている。（そして切断ダイアログ表示中に更に呼び出された切断ダイアログは、無視される。）
             * 例えば、リモコンファイルのImport中にHUISが切断された場合などに本Workaroundが有効に働く。
             *
             * @param options {ElectronMessageDialogOptions} ファイル保存ダイアログのオプション
             * @param callback {Function} ダイアログを開いた後に呼び出されるコールバック関数
             */
            showDisconnectedMessageBoxForDarwin(options?: ElectronMessageBoxOptions, callback?: (response: any) => void): number {
                this._disableDialog();
                // This method does NOT check enabled, because this method is called repeatedly when other dialog is displayed.
                this._resetElectronDialog();
                this._enabled = true;
                return this._showMessageBox("current", options, callback);
            }

            /**
             * callback が指定されている場合は非同期、指定されていない場合は同期でメッセージダイアログを開く
             */
            private _showMessageBox(owner: ElectronShim.DialogOwner, options?: ElectronMessageBoxOptions, callback?: (response: any) => void): number {
                if (callback) {
                    this._dialog.showMessageBox(owner, options || {}).then(callback);
                    return undefined;
                }
                return this._dialog.showMessageBoxSync(owner, options || {});
            }

            /**
             * Electron のダイアログを使用するための初期設定
             */
            private _resetElectronDialog() {
                // 一度このアプリにフォーカスがある状態でダイアログを開いた後は、常にこのウィンドウを親にする
                if (this._dialogOwner === "none" && ElectronShim.remote.getCurrentWindow().isFocused()) {
                    this._dialogOwner = "current"; // focusが他のアプリやDebuggerにある間は親なしで開く
                }
            }

            private _disableDialog() {
                this._enabled = false;
            }
        }
    }
}
