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

/**
 * Electron の remote モジュール (Electron 14 で廃止) の代わりに、
 * 本アプリが使用している機能だけを main プロセスへの IPC で提供する。
 * main プロセス側の処理は main.js を参照。
 */
namespace Garage {
    export namespace ElectronShim {

        const ipcRenderer: import("electron").IpcRenderer = require("electron").ipcRenderer;

        /**
         * ダイアログの親ウィンドウの指定
         *  "focused": フォーカスされているウィンドウ (他のアプリにフォーカスがある場合は親なし)
         *  "current": このウィンドウ
         *  "none": 親なし
         */
        export type DialogOwner = "focused" | "current" | "none";

        /**
         * remote.getCurrentWindow() で取得していた BrowserWindow の代替
         */
        export class CurrentWindow {
            setMinimumSize(width: number, height: number): void {
                ipcRenderer.send("garage:window:call", "setMinimumSize", [width, height]);
            }

            setMenuBarVisibility(visible: boolean): void {
                ipcRenderer.send("garage:window:call", "setMenuBarVisibility", [visible]);
            }

            inspectElement(x: number, y: number): void {
                ipcRenderer.send("garage:window:call", "inspectElement", [x, y]);
            }

            isFocused(): boolean {
                return ipcRenderer.sendSync("garage:window:isFocused");
            }
        }

        const currentWindow = new CurrentWindow();

        export const remote = {
            getCurrentWindow: (): CurrentWindow => currentWindow,
        };

        /**
         * remote.app の代替
         */
        export const app = {
            getPath: (name: string): string => ipcRenderer.sendSync("garage:app:getPath", name),
            // remote.app.exit() と同様に、終了するまで renderer の処理を進めない
            exit: (exitCode?: number): void => ipcRenderer.sendSync("garage:app:exit", exitCode || 0),
        };

        /**
         * remote.dialog の代替
         */
        export const dialog = {
            showMessageBoxSync: (owner: DialogOwner, options: any): number =>
                ipcRenderer.sendSync("garage:dialog:showMessageBoxSync", owner, options),
            showMessageBox: (owner: DialogOwner, options: any): Promise<number> =>
                ipcRenderer.invoke("garage:dialog:showMessageBox", owner, options),
            showOpenDialog: (owner: DialogOwner, options: any): Promise<string[] | undefined> =>
                ipcRenderer.invoke("garage:dialog:showOpenDialog", owner, options),
            showSaveDialog: (owner: DialogOwner, options: any): Promise<string | undefined> =>
                ipcRenderer.invoke("garage:dialog:showSaveDialog", owner, options),
        };

        export interface MenuItemOptions {
            label?: string;
            type?: string;
            accelerator?: string;
            enabled?: boolean;
            visible?: boolean;
            click?: () => void;
        }

        /**
         * remote.MenuItem の代替
         */
        export class MenuItem {
            constructor(public options: MenuItemOptions) {
            }
        }

        /**
         * remote.Menu の代替 (コンテキストメニュー用)
         */
        export class Menu {
            items: MenuItem[] = [];

            append(item: MenuItem): void {
                this.items.push(item);
            }

            clear(): void {
                this.items = [];
            }

            popup(window?: CurrentWindow): void {
                let items = this.items;
                // click 以外の、IPC で送れる項目だけを送る
                let template = items.map((item) => {
                    let { click, ...options } = item.options;
                    return options;
                });
                ipcRenderer.invoke("garage:menu:popup", template)
                    .then((index: number) => {
                        if (index != null && items[index] && items[index].options.click) {
                            items[index].options.click();
                        }
                    });
            }
        }
    }
}
