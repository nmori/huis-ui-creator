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
 * require.js module "i18n"
 *
 * cdp.framework.jqm とアプリが使用している i18next 1.x の API
 *  - $.i18n.init({ resGetPath }) : jQuery promise を返す
 *  - $.i18n.t(key)
 *  - $(selector).i18n()          : data-i18n 属性の翻訳
 * を、i18next (現行版) と jquery-i18next で提供する。
 */
define(["jquery"], ($: JQueryStatic) => {
    const i18next: import("i18next").i18n = require("i18next");
    const jqueryI18next = require("jquery-i18next");
    const nodeUrl: typeof import("url") = require("url");
    const nodeFs: typeof import("fs") = require("fs");

    const FALLBACK_LNG = "dev";
    const NAMESPACE = "translation";

    /**
     * i18next 1.x と同じ順序で読み込む言語の一覧を返す (例: "ja-JP" → ["ja-JP", "ja", "dev"])
     */
    function getLanguages(lng: string): string[] {
        let languages = [lng];
        if (0 < lng.indexOf("-")) {
            languages.push(lng.split("-")[0]);
        }
        languages.push(FALLBACK_LNG);
        return languages.filter((value, index, self) => self.indexOf(value) === index);
    }

    /**
     * resGetPath ("res/locales/__ns__-__lng__.json") の各言語のファイルを読み込む。存在しない言語は読み飛ばす。
     */
    function loadResources(resGetPath: string, languages: string[]): import("i18next").Resource {
        let resources: import("i18next").Resource = {};
        for (let lng of languages) {
            let relativePath = resGetPath.replace(/__ns__/g, NAMESPACE).replace(/__lng__/g, lng);
            let filePath = nodeUrl.fileURLToPath(new URL(relativePath, document.baseURI));
            if (!nodeFs.existsSync(filePath)) {
                continue;
            }
            resources[lng] = {};
            // ロケールファイルは BOM 付き UTF-8
            resources[lng][NAMESPACE] = JSON.parse(nodeFs.readFileSync(filePath, "utf8").replace(/^﻿/, ""));
        }
        return resources;
    }

    // $(selector).i18n() で data-i18n 属性を翻訳する
    jqueryI18next.init(i18next, $, {
        tName: "t",
        i18nName: "i18next",
        handleName: "i18n",
        selectorAttr: "data-i18n",
    });

    let compat = {
        init: (options?: { resGetPath?: string }): JQueryPromise<any> => {
            let df = $.Deferred();
            let lng = navigator.language || FALLBACK_LNG;
            let resGetPath = (options && options.resGetPath) || "locales/__lng__/__ns__.json";
            try {
                i18next.init({
                    lng: lng,
                    fallbackLng: FALLBACK_LNG,
                    resources: loadResources(resGetPath, getLanguages(lng)),
                    ns: [NAMESPACE],
                    defaultNS: NAMESPACE,
                    initAsync: false,
                    interpolation: {
                        escapeValue: false, // i18next 1.x の既定 (escapeInterpolation: false) に合わせる
                    },
                }).then(() => df.resolve(), (err) => {
                    console.error("i18next.init() failed: " + err);
                    df.reject(err);
                });
            } catch (err) {
                console.error("i18next.init() failed: " + err);
                df.reject(err);
            }
            return df.promise();
        },
        t: ((...args: any[]) => (<any>i18next.t)(...args)) as import("i18next").TFunction,
    };

    (<any>$).i18n = compat;
    return compat;
});
