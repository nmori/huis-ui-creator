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

/// <reference path="../../include/interfaces.d.ts" />

namespace Garage {
    export namespace Model {

        const TAG: string = "[Garage.Model.SharedInfo] ";

        export namespace SettingColor {
            export const WHITE: string = "white";
            export const BLACK: string = "black";
        }

        export namespace ModelColor {
            export const WHITE: string = "white";
            export const BLACK: string = "black";
        }

        /**
         * HUISと共有する情報を格納するクラス。
         * 色情報、Version情報が主。
         */
        export class SharedInfo {

            // system
            private _version: string;
            private _winRequiredVersion: string;
            private _macRequiredVersion: string;
            private _isBtoB: boolean;

            // color
            private _modelColor: string;
            private _settingColor: string;

            // theme
            private _theme_state: boolean;
            private _theme_file_name: string;
            private _theme_path: string;
            private _theme_version: number;

            constructor(sharedInfo: ISharedInfo) {
                // 古いファームウェアの sharedinfo.ini には theme セクション等が存在しないため、
                // セクションごとに読み込み、存在しないセクションは既定値とする
                // (1 つでも欠けると version まで既定値になり、バージョンチェックで弾かれてしまう)
                const system = (sharedInfo && sharedInfo.system) || <any>{};
                const color = (sharedInfo && sharedInfo.color) || <any>{};
                const theme = (sharedInfo && sharedInfo.theme) || <any>{};
                if (sharedInfo == null || sharedInfo.system == null) {
                    console.log("[sharedinfo] system section is not found");
                }

                this._version = system.version || "0.0.0";
                this._winRequiredVersion = system.win_required_version || "0.0.0";
                this._macRequiredVersion = system.mac_required_version || "0.0.0";
                this._isBtoB = (system.is_btob != null);

                this._modelColor = color.model_color || ModelColor.WHITE;
                this._settingColor = color.setting_color || SettingColor.WHITE;

                this._theme_state = (theme.theme_state === "true");
                this._theme_file_name = theme.theme_file_name || "";
                this._theme_path = theme.theme_path || "";
                this._theme_version = theme.version || 0;
            }

            get version(): string {
                return this._version;
            }

            get modelColor(): string {
                return this._modelColor;
            }

            /**
             * 白モデルかどうか確認する
             * @return {boolean} 白モデルのときtrueを返す
             */
            isWhiteModel(): boolean {
                return this.modelColor === Model.ModelColor.WHITE;
            }

            get settingColor(): string {
                return this._settingColor;
            }

            /**
             * UIが白設定どうか確認する
             * @return {boolean} 白モデルのときtrueを返す
             */
            isWhiteSetting(): boolean {
                return this.settingColor === Model.SettingColor.WHITE;
            }

            get isBtoB(): boolean {
                return this._isBtoB;
            }

            get requiredGarageVersion(): string {
                return Util.MiscUtil.isDarwin() ? this._macRequiredVersion : this._winRequiredVersion;
            }

            get themeState(): boolean {
                return this._theme_state;
            }

            get themeFileName(): string {
                return this._theme_file_name;
            }

            get themePath(): string {
                return this._theme_path;
            }

            get themeVersion(): number {
                return this._theme_version;
            }
        }
    }
}
