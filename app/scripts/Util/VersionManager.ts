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

/// <referecen path="../include/interfaces.d.ts" />

namespace Garage {
    export namespace Util {

        namespace ConstValue {
            export const LAST_NOTIFIED_VERSION_TEXT_PATH: string = Util.PathManager.join(GARAGE_FILES_ROOT, "last_notified_version.txt");
            export const LAST_NOTIFIED_BZ_VERSION_TEXT_PATH: string = Util.PathManager.join(GARAGE_FILES_ROOT, "last_notified_bz_version.txt");
        }

        /**
         * 機能ごとに必要な HUIS 本体のファームウェアのバージョン。
         * 過去の UI CREATOR が要求していたバージョン (前回アップデートのバージョン + 0.0.1) に合わせている。
         */
        export namespace HuisFirmware {
            /** UI CREATOR がサポートする最も古いファームウェア : UI CREATOR 3.0.0 */
            export const MINIMUM: string = "3.1.2";
            /** sharedinfo.ini (本体の色設定、バージョン情報) : UI CREATOR 4.0.0 */
            export const SHARED_INFO: string = "4.1.1";
            /** ジャンプボタン : UI CREATOR 5.0.0 */
            export const JUMP: string = "4.2.3";
            /** お気に入り待受画面 : UI CREATOR 7.0.0 */
            export const SCREENSAVER: string = "4.5.1";
            /** テーマ、ボタン単位の group 情報 : UI CREATOR 9.0.0 */
            export const BUTTON_GROUP: string = "4.6.1";
        }

        export class VersionManager {

            private hasLastNotifiedVersionFile(): boolean {
                try {
                    fs.statSync(VersionManager.getLastNotifiedVersionVersionFilePath());
                    return true;
                } catch (err) {
                    return false;
                }
            }

            public getLastNotifiedVersion(): Model.Version.AppVersionString {
                const file_path: string = VersionManager.getLastNotifiedVersionVersionFilePath();
                if (fs.existsSync(file_path)) {
                    return new Model.Version.AppVersionString(fs.readFileSync(file_path).toString());
                }

                // first launch after installation
                console.warn(file_path + " is not exist.");
                return new Model.Version.AppVersionString("0.0.0");
            }

            /**
             * check app installed newly
             * check if last_notified_version file exists.
             */
            public isInstalledNewly(): boolean {
                // LAST_NOTIFIED_FILE means has already app started, so not newly
                return !this.hasLastNotifiedVersionFile();
            }

            public isUpdated(): boolean {
                let currentVersion = new Model.Version.AppVersionString(APP_VERSION);

                try {
                    return currentVersion.isNewerThan(this.getLastNotifiedVersion());
                } catch (err) {
                    console.error("version check error : " + err);
                }
                return false;
            }

            public updateLastNotifiedVersionFile() {
                fs.outputFile(
                    VersionManager.getLastNotifiedVersionVersionFilePath(),
                    APP_VERSION,
                    function (err) {
                        console.log(err);
                    });
            }

            public static getLastNotifiedVersionVersionFilePath(): string {
                return Util.MiscUtil.isBz()
                    ? ConstValue.LAST_NOTIFIED_BZ_VERSION_TEXT_PATH
                    : ConstValue.LAST_NOTIFIED_VERSION_TEXT_PATH;
            }

            /**
             * UI CREATOR の要求する、HUIS本体の最低限のバージョン。
             * 基本的に、前回アップデートのバージョン + 0.0.1
             *
             * ファームウェアの配布が終了しているため、BtoC 版は古いファームウェアでも
             * 共通の機能は使えるよう、UI CREATOR 3.0.0 がサポートしていたバージョンまで下げている。
             * 新しいファームウェアでのみ動作する機能は isXxxSupported() で出し分け、
             * sharedinfo.ini がない本体へは isLegacyFormat() で旧形式のファイルを出力する。
             */
            public static getHuisRcRequiredVersion(): string {
                if (Util.MiscUtil.isBz()) {
                    return "A.3.1";
                }
                return HuisFirmware.MINIMUM;
            }

            /**
             * ユーザーに表示する、HUIS本体の要求バージョン。評価用に実際にチェックする値とは別に値を用意。
             * 基本的に、前回アップデートのバージョン + 0.1.0
             */
            public static getDisplayHuisRcRequiredVersion(): string {
                if (Util.MiscUtil.isBz()) {
                    return "A.4.0";
                }
                return "4.0.0";
            }

            /**
             * 接続している HUIS 本体が、UI CREATOR 4.0.0 より前の形式のファイルしか扱えないかどうか。
             * (ラベル色が数値、face の color / module の group がない、など)
             */
            public static isLegacyFormat(): boolean {
                return !VersionManager.isHuisRcVersionAtLeast(HuisFirmware.SHARED_INFO);
            }

            /**
             * 接続している HUIS 本体のファームウェアが、指定したバージョン以上かどうか。
             * BtoB 版は従来どおり最新のファームウェアのみをサポートするため常に true。
             *
             * @param {string} requiredVersion HuisFirmware の値
             */
            public static isHuisRcVersionAtLeast(requiredVersion: string): boolean {
                if (Util.MiscUtil.isBz()) {
                    return true;
                }
                if (sharedInfo == null) {
                    return false;
                }
                let rcVersion = new Model.Version.HuisVersionString(sharedInfo.version);
                if (!rcVersion.isValid()) {
                    return false;
                }
                return !rcVersion.isOlderThan(new Model.Version.HuisVersionString(requiredVersion));
            }

            /** ジャンプボタン (UI CREATOR 5.0.0 / HUIS 4.3.0 以降) */
            public static isJumpSupported(): boolean {
                return VersionManager.isHuisRcVersionAtLeast(HuisFirmware.JUMP);
            }

            /** お気に入り待受画面 (UI CREATOR 7.0.0 / HUIS 4.6.0 以降) */
            public static isScreensaverSupported(): boolean {
                return VersionManager.isHuisRcVersionAtLeast(HuisFirmware.SCREENSAVER);
            }

            /** ボタン単位の group 情報 (UI CREATOR 9.0.0 / HUIS 5.0.0 以降) */
            public static isButtonGroupSupported(): boolean {
                return VersionManager.isHuisRcVersionAtLeast(HuisFirmware.BUTTON_GROUP);
            }
        }
    }
}
