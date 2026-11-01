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
 * require.js module "jquery" (config.ts の map 設定で、"jquery" の参照はすべてこのモジュールに向く)
 *
 * jQuery Mobile 1.4.5 / cdp.framework は jQuery 2 系の API を前提としているため、
 * jQuery に jquery-migrate を適用してから返す。
 * また、Electron の renderer では module オブジェクトが存在するため jQuery が window.$ を定義しない。
 * アプリは $ をグローバルとして使用しているので、ここで定義する。
 */
define(["jquery", "jquery-migrate"], ($: JQueryStatic) => {
    // jquery-migrate 4 が対象としない、jQuery 3.0 で削除された API のうち jQuery Mobile 1.4.5 が使用しているもの
    // (jquery-migrate 3 と同じ実装)
    //  - .load(handler) / .unload(handler) / .error(handler) のイベントの短縮形
    let oldLoad = (<any>$.fn).load;
    ["load", "unload", "error"].forEach((name) => {
        $.fn[name] = function (...args: any[]) {
            if (name === "load" && typeof args[0] === "string") {
                return oldLoad.apply(this, args);
            }
            args.unshift(name);
            if (1 < args.length) {
                return this.on.apply(this, args);
            }
            this.triggerHandler.apply(this, args);
            return this;
        };
    });

    // jquery-migrate の警告は DEBUG ビルドのみ表示する
    (<any>$).migrateMute = !Config.DEBUG;

    (<any>window).jQuery = (<any>window).$ = $;
    return $;
});
