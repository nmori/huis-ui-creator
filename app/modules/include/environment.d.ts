// Electron renderer (nodeIntegration) / require.js globals

declare var fs: typeof import("fs-extra");
declare var path: typeof import("path");

declare var requirejs: any;
declare function define(name: string, deps: string[], factory: (...modules: any[]) => any): void;
declare function define(deps: string[], factory: (...modules: any[]) => any): void;

// i18next 1.x 互換の API (scripts/include/I18nCompat.ts)
interface JQueryStatic {
    i18n: {
        init(options?: { resGetPath?: string }): JQueryPromise<any>;
        t: import("i18next").TFunction;
    };
}

interface JQuery<TElement = HTMLElement> {
    i18n(options?: any): this;
}