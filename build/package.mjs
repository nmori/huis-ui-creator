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

function log(message) {
    console.log("[package] " + message);
}

// 1. release ビルド
execFileSync(process.execPath, [path.join(ROOT, "build", "build.mjs"), "--release"], { cwd: ROOT, stdio: "inherit" });

// 2. www/ に実行時の依存モジュールをインストールする
log(`npm install --omit=dev (${platform}-${arch})`);
fs.rmSync(path.join(WWW, "node_modules"), { recursive: true, force: true });
fs.rmSync(path.join(WWW, "package-lock.json"), { force: true });
const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
execFileSync(process.execPath, [
    fs.existsSync(npmCli) ? npmCli : process.env.npm_execpath,
    "install", "--omit=dev", "--install-links", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock",
    `--os=${platform}`, `--cpu=${arch}`,
], { cwd: WWW, stdio: "inherit" });

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
