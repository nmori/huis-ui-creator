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

// アプリの生存期間をコントロールするモジュール
// ネイティブのブラウザウィンドウを作るためのモジュール
// 及び renderer から依頼されたダイアログ・メニュー等を扱うためのモジュールを require する
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ウィンドウオブジェクトをグローバル宣言する
// JavaScript のオブジェクトが GC されたときにウィンドウが閉じてしまうため
let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// すべてのウィンドウが閉じられたら終了
app.on('window-all-closed', () => {
    // OSXでもwindowを閉じる際にUI Creatorを終了する
    app.quit();
});

// アプリ外のページへの遷移や新規ウィンドウの作成を禁止する
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (navigateEvent, url) => {
        if (!url.startsWith('file://')) {
            navigateEvent.preventDefault();
        }
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Electron の初期化が終わってブラウザウィンドウを作る準備ができたら呼ばれる
app.whenReady().then(() => {
    // 既定のアプリケーションメニュー (リロード・開発者ツール等) は使わない。
    // macOS ではテキスト入力のコピー&ペーストのため、最低限のメニューだけ用意する。
    if (process.platform === 'darwin') {
        Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
    } else {
        Menu.setApplicationMenu(null);
    }

    // ブラウザウィンドウを作る
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 768,
        icon: path.join(__dirname, 'app', 'huis-favicon.png'),
        title: 'HUIS UI CREATOR',
        backgroundColor: '#000000',
        webPreferences: {
            // 本アプリの renderer は fs 等の Node.js API とネイティブモジュール (usb_dev) を直接使用する。
            // 読み込むのはアプリ内のローカルファイルのみ (上の will-navigate / setWindowOpenHandler で制限)。
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            spellcheck: false,
        },
    });

    // アプリの index.html をロードする
    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

    // garage.exe と同じディレクトリーに "debug" があれば devtools を開く
    if (fs.existsSync('debug')) {
        mainWindow.webContents.openDevTools();
    }

    // ウィンドウが閉じられたら実行
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

//////////////////////////////////////////////////////////////////////////////
// renderer (app/scripts/include/ElectronShim.ts) からの依頼を処理する
//////////////////////////////////////////////////////////////////////////////

/**
 * ダイアログの親ウィンドウを取得する。
 * owner が "focused" の場合はフォーカスされているウィンドウ (他のアプリにフォーカスがある場合は null)、
 * "current" の場合は依頼元のウィンドウ。
 */
function getDialogOwner(sender, owner) {
    if (owner === 'current') {
        return BrowserWindow.fromWebContents(sender);
    }
    if (owner === 'focused') {
        return BrowserWindow.getFocusedWindow();
    }
    return null;
}

function withOwner(owner, func) {
    return owner ? func(owner) : func();
}

ipcMain.on('garage:window:isFocused', (event) => {
    event.returnValue = BrowserWindow.getFocusedWindow() === BrowserWindow.fromWebContents(event.sender);
});

ipcMain.on('garage:window:call', (event, method, args) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
        return;
    }
    switch (method) {
        case 'setMinimumSize':
            window.setMinimumSize(args[0], args[1]);
            break;
        case 'setMenuBarVisibility':
            window.setMenuBarVisibility(args[0]);
            break;
        case 'inspectElement':
            event.sender.inspectElement(args[0], args[1]);
            break;
        default:
            console.error('garage:window:call unknown method: ' + method);
    }
});

ipcMain.on('garage:app:getPath', (event, name) => {
    event.returnValue = app.getPath(name);
});

// renderer は終了を同期で待つ。応答を返さずに終了することで、呼び出し後に renderer の処理を続行させない
// (remote.app.exit() と同じ挙動)
ipcMain.on('garage:app:exit', (event, exitCode) => {
    app.exit(exitCode);
});

ipcMain.on('garage:dialog:showMessageBoxSync', (event, owner, options) => {
    const window = getDialogOwner(event.sender, owner);
    event.returnValue = withOwner(window, (...w) => dialog.showMessageBoxSync(...w, options));
});

ipcMain.handle('garage:dialog:showMessageBox', async (event, owner, options) => {
    const window = getDialogOwner(event.sender, owner);
    const result = await withOwner(window, (...w) => dialog.showMessageBox(...w, options));
    return result.response;
});

ipcMain.handle('garage:dialog:showOpenDialog', async (event, owner, options) => {
    const window = getDialogOwner(event.sender, owner);
    const result = await withOwner(window, (...w) => dialog.showOpenDialog(...w, options));
    return result.canceled ? undefined : result.filePaths;
});

ipcMain.handle('garage:dialog:showSaveDialog', async (event, owner, options) => {
    const window = getDialogOwner(event.sender, owner);
    const result = await withOwner(window, (...w) => dialog.showSaveDialog(...w, options));
    return result.canceled ? undefined : result.filePath;
});

/**
 * コンテキストメニューを表示し、選択された項目の index を返す (選択されなかった場合は null)
 */
ipcMain.handle('garage:menu:popup', (event, items) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return new Promise((resolve) => {
        const template = items.map((item, index) => Object.assign({}, item, {
            click: () => resolve(index),
        }));
        const menu = Menu.buildFromTemplate(template);
        menu.popup({
            window: window,
            callback: () => {
                // click と close の通知順は OS によって異なるため、close 側は少し遅らせて未選択として扱う
                // (先に resolve された値が優先される)
                setTimeout(() => resolve(null), 50);
            },
        });
    });
});
