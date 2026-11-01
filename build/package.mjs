/*
 * HUIS UI CREATOR packaging script
 *
 *   node build/package.mjs [--platform=win32|darwin] [--arch=x64|ia32|arm64]
 *
 * release ビルドを行い、dist/<アプリ名>-<platform>-<arch>/ に Electron アプリとしてパッケージングする。
 * platform / arch を省略した場合は、ビルドを実行している環境のものを使用する。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WWW = path.join(ROOT, "www");
const DIST = path.join(ROOT, "dist");
const require = createRequire(path.join(ROOT, "package.json"));

function option(name, defaultValue) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.slice(name.length + 3) : defaultValue;
}

const platform = option("platform", process.platform);
const arch = option("arch", process.arch);
// npm / node-gyp へそのまま渡すため、想定外の値は受け付けない
if (!["win32", "darwin", "linux"].includes(platform) || !["x64", "ia32", "arm64"].includes(arch)) {
    console.error(`[package] unsupported platform/arch: ${platform}-${arch}`);
    process.exit(1);
}

function log(message) {
    console.log("[package] " + message);
}

// 1. release ビルド
execFileSync(process.execPath, [path.join(ROOT, "build", "build.mjs"), "--release"], { cwd: ROOT, stdio: "inherit" });

// 2. www/ に実行時の依存モジュールをインストールする
log(`npm install --omit=dev (${platform}-${arch})`);
fs.rmSync(path.join(WWW, "node_modules"), { recursive: true, force: true });
fs.rmSync(path.join(WWW, "package-lock.json"), { force: true });
const npmArgs = [
    "install", "--omit=dev", "--install-links", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock",
    `--os=${platform}`, `--cpu=${arch}`,
];
// npm-cli.js の場所: npm run 経由なら npm_execpath、それ以外は node と同梱の npm
// (Windows: <node のディレクトリ>/node_modules、macOS/Linux: <prefix>/lib/node_modules)
const nodeDir = path.dirname(process.execPath);
const npmCli = [
    process.env.npm_execpath,
    path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
].find((p) => p && /\.c?js$/.test(p) && fs.existsSync(p));
if (npmCli) {
    execFileSync(process.execPath, [npmCli, ...npmArgs], { cwd: WWW, stdio: "inherit" });
} else {
    // 見つからない場合は PATH 上の npm を使う (Windows の npm.cmd はシェル経由でないと起動できない)
    execFileSync("npm", npmArgs, { cwd: WWW, stdio: "inherit", shell: process.platform === "win32" });
}

// usb_dev (Windows のみ) は対象 arch 向けにビルドし、実行に必要な .node 以外のビルド成果物は削除する
const usbDevDir = path.join(WWW, "node_modules", "usb_dev");
if (fs.existsSync(usbDevDir)) {
    log(`build usb_dev (${arch})`);
    const nodeGyp = path.join(path.dirname(require.resolve("node-gyp/package.json")), "bin", "node-gyp.js");
    execFileSync(process.execPath, [nodeGyp, "rebuild", `--arch=${arch}`], { cwd: usbDevDir, stdio: "inherit" });
    const releaseDir = path.join(usbDevDir, "build", "Release");
    const addon = fs.readFileSync(path.join(releaseDir, "usb_dev.node"));
    fs.rmSync(path.join(usbDevDir, "build"), { recursive: true, force: true });
    fs.mkdirSync(releaseDir, { recursive: true });
    fs.writeFileSync(path.join(releaseDir, "usb_dev.node"), addon);
    fs.rmSync(path.join(WWW, "node_modules", "node-addon-api"), { recursive: true, force: true }); // ビルド時のみ使用
}

// 3. パッケージング
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const electronVersion = JSON.parse(fs.readFileSync(require.resolve("electron/package.json"), "utf8")).version;
log(`electron ${electronVersion}`);
const outputs = await packager({
    dir: WWW,
    out: DIST,
    name: pkg.productName,
    appVersion: pkg.version,
    platform,
    arch,
    electronVersion,
    overwrite: true,
    prune: false, // 2. で本番用の依存のみをインストール済み
    asar: false,
    ignore: [/^\/\.gitkeep$/, /^\/package-lock\.json$/],
    win32metadata: {
        CompanyName: pkg.productName,
        ProductName: pkg.productName,
        FileDescription: pkg.productName,
    },
});
for (const output of outputs) {
    log("created " + output);
}

// 4. 配布用のファイル (ライセンス一式、はじめにお読みください) を追加し、zip にまとめる
for (const output of outputs) {
    prepareDistribution(output);
    const zipPath = path.join(DIST, `${pkg.name}-${pkg.version}-${platform}-${arch}.zip`);
    await createZip(output, pkg.productName, zipPath);
    log("created " + zipPath);
}

/**
 * パッケージのルートに licenses/ と「はじめにお読みください.txt」を配置する。
 * Electron が出力する LICENSE (Electron の MIT ライセンス) はアプリ本体のライセンスと紛らわしいため licenses/ へ移す。
 */
function prepareDistribution(outputDir) {
    const licensesDir = path.join(outputDir, "licenses");
    fs.mkdirSync(licensesDir, { recursive: true });

    const copies = [
        [path.join(ROOT, "LICENSE"), "HUIS-UI-CREATOR-LICENSE.txt"],
        [path.join(WWW, "app", "res", "license", "licenses.txt"), "THIRD-PARTY-LICENSES.txt"],
        [path.join(WWW, "app", "res", "fonts", "LICENSE_OFL.txt"), "NotoSansCJKjp-LICENSE.txt"],
    ];
    for (const [src, name] of copies) {
        fs.copyFileSync(src, path.join(licensesDir, name));
    }
    const moves = [
        ["LICENSE", "Electron-LICENSE.txt"],
        ["LICENSES.chromium.html", "LICENSES.chromium.html"],
    ];
    for (const [src, name] of moves) {
        const srcPath = path.join(outputDir, src);
        if (fs.existsSync(srcPath)) {
            fs.renameSync(srcPath, path.join(licensesDir, name));
        }
    }

    const readme = fs.readFileSync(path.join(ROOT, "build", "dist-readme.txt"), "utf8")
        .replace(/^﻿/, "")
        .replaceAll("%VERSION%", pkg.version)
        .replace(/\r?\n/g, "\r\n");
    fs.writeFileSync(path.join(outputDir, "はじめにお読みください.txt"), "﻿" + readme);
}

/**
 * dir の中身を、rootName フォルダに入れた形で zip にまとめる
 */
async function createZip(dir, rootName, zipPath) {
    const { ZipWriter, Uint8ArrayReader, configure } = await import("@zip.js/zip.js");
    const { Writable } = await import("node:stream");
    configure({ useWebWorkers: false });

    fs.rmSync(zipPath, { force: true });
    const zipWriter = new ZipWriter(Writable.toWeb(fs.createWriteStream(zipPath)));
    const walk = async (absDir, relDir) => {
        for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
            const absPath = path.join(absDir, entry.name);
            const relPath = relDir + "/" + entry.name;
            if (entry.isDirectory()) {
                await zipWriter.add(relPath + "/", null, { directory: true });
                await walk(absPath, relPath);
            } else {
                const stat = fs.statSync(absPath);
                await zipWriter.add(relPath, new Uint8ArrayReader(fs.readFileSync(absPath)), { lastModDate: stat.mtime });
            }
        }
    };
    await walk(dir, rootName);
    await zipWriter.close();
}
