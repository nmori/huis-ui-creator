/*
 * HUIS UI CREATOR build script
 *
 *   node build/build.mjs [--release]
 *
 * app/ をビルドして www/ に Electron アプリとして実行できる形で出力する。
 *   www/main.js, www/package.json   : Electron のエントリー
 *   www/app/                        : app/ のコピー (TypeScript / SCSS はコンパイル結果)
 *   www/app/modules/                : npm で管理しているブラウザー向けライブラリ
 *   www/app/res/license/            : 同梱するソフトウェアのライセンス表記 (生成)
 *
 * --release を指定すると、DEBUG フラグを無効化し、source map を出力しない。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "app");
const WWW = path.join(ROOT, "www");
const DST = path.join(WWW, "app");
const require = createRequire(path.join(ROOT, "package.json"));

const release = process.argv.includes("--release");

/** app/ からコピーしないファイル (コンパイル対象・型定義) */
const SOURCE_ONLY = [/\.ts$/, /\.scss$/, /^modules[\\/]include([\\/]|$)/];

/**
 * npm で管理しているブラウザー向けライブラリ (require.js で読み込む)。
 * [パッケージ内のファイル, www/app からの出力先]
 */
const BROWSER_LIBRARIES = [
    ["jquery/dist/jquery.js", "modules/jquery/scripts/jquery.js"],
    ["jquery-migrate/dist/jquery-migrate.js", "modules/jquery/scripts/jquery-migrate.js"],
    ["backbone/backbone.js", "modules/backbone/scripts/backbone.js"],
    ["underscore/underscore-umd.js", "modules/underscore/scripts/underscore.js"],
    ["requirejs/require.js", "modules/requirejs/scripts/require.js"],
    ["mustache/mustache.js", "modules/mustache/scripts/mustache.js"],
];

/** LICENSE ファイルを同梱していない npm パッケージのライセンス (ソースのヘッダーの記載による) */
const LICENSE_FALLBACKS = {
    requirejs: () => mitLicense("Copyright jQuery Foundation and other contributors"),
};

/** npm 以外で同梱しているライブラリのライセンス */
const VENDORED_LICENSES = [
    {
        name: "jquery-mobile",
        text: mitLicense("Copyright 2010, 2014 jQuery Foundation, Inc. and other contributors"),
    },
];

function log(message) {
    console.log("[build] " + message);
}

function mitLicense(copyright) {
    return `The MIT License (MIT)

${copyright}

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
}

/**
 * node_modules 内のファイルのパスを返す ("package/sub/file.js")。
 * package.json の exports に関係なく、パッケージのディレクトリーから解決する。
 */
function packageFile(request) {
    const parts = request.split("/");
    const nameLength = request.startsWith("@") ? 2 : 1;
    const dir = path.dirname(findPackageJson(ROOT, parts.slice(0, nameLength).join("/")));
    return path.join(dir, ...parts.slice(nameLength));
}

/** パッケージの bin (package.json の "bin") のパスを返す */
function binOf(packageName, binName) {
    const dir = packageFile(packageName);
    const bin = readPackageJson(dir).bin;
    return path.join(dir, typeof bin === "string" ? bin : bin[binName]);
}

function run(command, args) {
    log(`${command} ${args.join(" ")}`);
    // .cmd は shell 経由でないと起動できないため、node から直接 JS のエントリーを実行する
    execFileSync(process.execPath, [command, ...args], { cwd: ROOT, stdio: "inherit" });
}

function clean() {
    for (const entry of fs.readdirSync(WWW)) {
        if (entry === ".gitkeep" || entry === "node_modules") {
            continue;
        }
        fs.rmSync(path.join(WWW, entry), { recursive: true, force: true });
    }
}

function copyApp() {
    log("copy app/ -> www/app/");
    fs.cpSync(SRC, DST, {
        recursive: true,
        filter: (src) => {
            const relative = path.relative(SRC, src);
            return !SOURCE_ONLY.some((pattern) => pattern.test(relative));
        },
    });
}

function compileTypeScript() {
    const args = ["-p", "tsconfig.json"];
    if (release) {
        args.push("--sourceMap", "false");
    }
    run(binOf("typescript", "tsc"), args);

    if (release) {
        const configPath = path.join(DST, "scripts", "config.js");
        const config = fs.readFileSync(configPath, "utf8");
        fs.writeFileSync(configPath, config.replace('"%% buildsetting %%"', '""'));
    }
}

function compileStylesheets() {
    const args = [
        path.join(SRC, "stylesheets", "app.scss"),
        path.join(DST, "stylesheets", "app.css"),
        "--quiet",
        release ? "--no-source-map" : "--embed-sources",
    ];
    run(binOf("sass", "sass"), args);
}

function copyBrowserLibraries() {
    for (const [from, to] of BROWSER_LIBRARIES) {
        const dst = path.join(DST, to);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(packageFile(from), dst);
    }
    log("copy browser libraries -> www/app/modules/");
}

function readPackageJson(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

/**
 * package.json の dependencies / optionalDependencies を推移的にたどり、同梱されるパッケージのディレクトリーを返す
 */
function collectRuntimePackages() {
    const packages = new Map();
    const visit = (fromDir, deps) => {
        for (const name of Object.keys(deps || {})) {
            let pkgJsonPath;
            try {
                pkgJsonPath = createRequire(path.join(fromDir, "package.json")).resolve(name + "/package.json");
            } catch {
                // package.json を exports で公開していないパッケージ
                pkgJsonPath = findPackageJson(fromDir, name);
            }
            if (!pkgJsonPath) {
                continue; // 他プラットフォーム向けの optionalDependencies など
            }
            const dir = path.dirname(pkgJsonPath);
            if (packages.has(dir)) {
                continue;
            }
            const pkg = readPackageJson(dir);
            packages.set(dir, pkg);
            visit(dir, { ...pkg.dependencies, ...pkg.optionalDependencies });
        }
    };
    const root = readPackageJson(ROOT);
    visit(ROOT, { ...root.dependencies, ...root.optionalDependencies });
    return [...packages.entries()]
        .map(([dir, pkg]) => ({ dir, pkg }))
        .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
}

function findPackageJson(fromDir, name) {
    for (let dir = fromDir; ; dir = path.dirname(dir)) {
        const candidate = path.join(dir, "node_modules", name, "package.json");
        if (fs.existsSync(candidate)) {
            return fs.realpathSync(candidate);
        }
        if (path.dirname(dir) === dir) {
            return null;
        }
    }
}

function readLicenseText(dir) {
    const file = fs.readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(entry));
    return file ? fs.readFileSync(path.join(dir, file), "utf8").trim() : null;
}

/**
 * ライセンス表記 (res/license/licenses.txt, LICENSES.chromium.html) を生成する
 */
function writeLicenses() {
    const licenseDir = path.join(DST, "res", "license");
    const electronDir = path.dirname(require.resolve("electron/package.json"));
    require("electron"); // Electron 本体 (dist) が未ダウンロードの場合はダウンロードする
    const sections = [];

    sections.push(`==> electron <==\n\n${readLicenseText(electronDir)}\n\n<a id="link-electron-licenses-file" href="LICENSES.chromium.html">詳しくはこちら</a>`);
    for (const { dir, pkg } of collectRuntimePackages()) {
        const text = readLicenseText(dir) || (LICENSE_FALLBACKS[pkg.name] && LICENSE_FALLBACKS[pkg.name]().trim());
        if (!text) {
            throw new Error(`license file not found: ${pkg.name} (${pkg.license})`);
        }
        sections.push(`==> ${pkg.name} <==\n\n${text}`);
    }
    for (const { name, text } of VENDORED_LICENSES) {
        sections.push(`==> ${name} <==\n\n${text.trim()}`);
    }
    sections.push(`==> Special thanks <==\n\nHUIS Team of Sony Corporation would like to take this opportunity to especially thank “Kazuto Kusama(@jacopen)” for his contribution to "HUIS UI CREATOR for Mac" development.`);

    fs.writeFileSync(path.join(licenseDir, "licenses.txt"), "﻿" + sections.join("\r\n\r\n\r\n").replace(/\r?\n/g, "\r\n") + "\r\n");

    const chromiumLicenses = path.join(electronDir, "dist", "LICENSES.chromium.html");
    if (fs.existsSync(chromiumLicenses)) {
        fs.copyFileSync(chromiumLicenses, path.join(licenseDir, "LICENSES.chromium.html"));
    } else {
        console.warn("[build] LICENSES.chromium.html not found in electron/dist (run `npm install` to download Electron)");
    }
    log("write res/license/licenses.txt");
}

function writeElectronEntry() {
    const root = readPackageJson(ROOT);
    // "file:" の参照 (native/usb_dev) は www/ からの相対パスに変換する
    const rebaseFileSpec = (spec) => spec.startsWith("file:")
        ? "file:" + path.relative(WWW, path.join(ROOT, spec.slice(5))).replace(/\\/g, "/")
        : spec;
    const pkg = {
        name: root.name,
        productName: root.productName,
        version: root.version,
        license: root.license,
        private: true,
        main: "main.js",
        dependencies: root.dependencies,
        optionalDependencies: Object.fromEntries(
            Object.entries(root.optionalDependencies || {}).map(([name, spec]) => [name, rebaseFileSpec(spec)])),
        allowScripts: Object.fromEntries(
            Object.entries(root.allowScripts || {}).map(([spec, allowed]) => [rebaseFileSpec(spec), allowed])),
    };
    fs.writeFileSync(path.join(WWW, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
    fs.copyFileSync(path.join(ROOT, "main.js"), path.join(WWW, "main.js"));
    log("write www/package.json, www/main.js");
}

clean();
copyApp();
compileTypeScript();
compileStylesheets();
copyBrowserLibraries();
writeLicenses();
writeElectronEntry();
log(`done (${release ? "release" : "debug"})`);
