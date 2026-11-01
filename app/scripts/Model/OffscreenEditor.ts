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

/// <reference path="../include/interfaces.d.ts" />

/* tslint:disable:max-line-length */

namespace Garage {
    export namespace Model {

        import IPromise = CDP.IPromise;
        //import makePromise = CDP.makePromise;
        import Framework = CDP.Framework;

        var TAG: string = "[Garage.Model.OffscreenEditor] ";

        export interface IImageEditParams {
            imageType?: string;            //!< 出力する画像の mimeType ("image/png" or "image/jpeg"。未指定の場合は、"image/png")
            resize?: IImageResizeParams; //!<画像リサイズのためのパラメーター
            grayscale?: number;            //!< グレースケールの度合い (0～1.0)。1.0 は完全にグレースケール
        }

        export interface IImageResizeParams {
            width: number;            //!< リサイズ後の横サイズ
            height: number;            //!< リサイズ後の縦サイズ
            force?: boolean;        //!< 元の画像サイズよりも大きくなる場合でもリサイズするかどうか
            padding?: boolean;        //!< 指定したサイズでリサイズしたときに生じた余白を維持するかどうか
            mode?: string; //!< 画像の拡大縮小モード。contain (default) / cover / stretch のいずれか。
        }

        export interface IEditImageResults {
            dataUrl: string; //<! 編集した画像の data URL
            path: string; //<! 編集した画像の保存先のパス
        }

        /**
         * @class OffscreenEditor
         * @brief Canvas 2D を使ってリサイズやグレースケール変換等の簡単な画像編集を行う
         */
        export class OffscreenEditor {
            private imageSrc_: string;

            /**
             * コンストラクター
             *
             * @param
             */
            constructor(imageSrc: string) {
                this.imageSrc_ = imageSrc;
            }

            /**
             * ハッシュ化が必要かどうか判断する。
             * ユーザー画像を指定した画像と、commonパーツの画像のみ有効にするため。
             * もともとのパスがremoteImagesの00XXがdstのパスでない場合は、ハッシュ化。
             * Screensaver機能の場合はハッシュ化をしない
             * TODO: editImageをもう少し汎用的にして、目的別にパラメータを変更して使うべき
             *
             * @param {string} dstPath 保存先のパス
             * @param {string} imageSrc 保存元のパス
             * @return {boolean} 
             */
            private static needHashName(dstPath: string, imageSrc: string): boolean {
                if (Model.ScreensaverDialog.isScreenSaverImage(dstPath)) {
                    return false;
                }
                if (Util.PathManager.isThemeImage(imageSrc)) {
                    return false;
                }
                let facePath = Util.MiscUtil.getAppropriatePath(CDP.Framework.toUrl("/res/faces/common/"));
                return imageSrc.indexOf(HUIS_REMOTEIMAGES_ROOT) === -1 && imageSrc.indexOf(facePath) === -1;
            }

            /**
             * 画像を編集し、編集した画像をファイル出力する
             * 
             * @param imageSrc {string} 編集する画像のパス
             * @param params {IImageEditparams} 画像編集のパラメーター
             * @param dstPath {string} 編集した画像の出力先のパス
             * @param {IPromise<IEditImageResults>} 編集結果。dstPath で指定したパスの拡張子が不適切な場合、適切な拡張子に変更されるので、出力ファイルパスは編集結果の path を参照すべき。
             */
            public static editImage(imageSrc: string, params: IImageEditParams, dstPath: string): IPromise<IEditImageResults>;
            /**
             * 画像を編集し、編集した画像の dataUrl を返す
             * 
             * @param imageSrc {string} 編集する画像のパス
             * @param params {IImageEditparams} 画像編集のパラメーター
             * @return {string} 編集した画像の dataUrl
             */
            public static editImage(imageSrc: string, params: IImageEditParams): IPromise<string>;

            public static editImage(imageSrc: string, params: IImageEditParams, dstPath?: string): IPromise<IEditImageResults | string> {
                let FUNCTION_NAME = TAG + "editImage : ";
                var df = $.Deferred();
                var promise: IPromise<IEditImageResults | string> = CDP.makePromise(df);
                var encodedDstPath = null;

                //変換するファイルが存在するか確認
                if (!fs.existsSync(imageSrc)) {
                    console.error(FUNCTION_NAME + imageSrc + "(imageSrc) does not exist");
                    df.reject();
                    return promise;
                }

                //imageSrcがディレクトリかどうか確認
                let fileStat = fs.lstatSync(imageSrc);
                if (fileStat != null && fileStat.isDirectory()) {
                    //imageSrcがファイル名ではなく、ディレクトリあった場合、エラー
                    console.error(FUNCTION_NAME + "imageSrc (" + imageSrc + ")is directory");
                    df.reject();
                    return promise;
                }

                console.log(TAG + "before editImage src: " + imageSrc);

                // 画像のロード
                OffscreenEditor.loadImage(imageSrc)
                    .done((image: HTMLImageElement) => {

                        //画像から、編集後の画像のデータを取得する。
                        let imageDataUrl = OffscreenEditor.getDataUrlOfEditedImage(image, params);

                        // 出力先のパスが指定されている場合は、ファイル出力を行う
                        if (dstPath) {

                            if (OffscreenEditor.needHashName(dstPath, imageSrc)) {
                                dstPath = this.getEncodedPath(dstPath);
                            }

                            // Buffer オブジェクトを使用して、base64 デコーディング
                            let buffer = Buffer.from(imageDataUrl.split("base64,")[1], "base64");

                            // imageType と指定したパスの拡張子が合わない場合は補正する。
                            dstPath = OffscreenEditor.getEditResultPath(dstPath, params.imageType);
                            encodedDstPath = OffscreenEditor.getEncodedPath(dstPath);

                            try {
                                fs.outputFileSync(dstPath, buffer);
                                console.log(TAG + "after editImage dst: " + dstPath);
                                df.resolve({
                                    dataUrl: imageDataUrl,
                                    path: dstPath
                                });
                            } catch (e) {
                                console.error(e);
                                df.reject(e);
                            }

                        } else { // 編集した画像の dataUrl を返す
                            df.resolve(imageDataUrl);
                        }
                    })
                    .fail(() => {
                        console.error(FUNCTION_NAME + "error occur in loadImage");
                        df.reject();
                    });

                return promise;
            }

            /**
             * 指定したパスを、画像編集後のパスに補正する。
             * 指定したパスの拡張子が、指定した imageType のものと不整合がある場合は、適切な拡張子を追加する。
             * 指定したパスの拡張子に問題がない場合は、そのままのパスを返す。
             * 
             * @param dstPath {string} 編集後のパスの候補。
             * @param imageType {string} 画像編集後のフォーマットの type。"image/png", "image/jpeg" が有効。省略した場合、または無効な type を指定した場合は、 "image/png" として扱われる。
             * 
             * @return {string} 補正したパス
             */
            public static getEditResultPath(dstPath: string, imageType?: string): string {
                let extension = ".png";
                if (imageType === "image/jpeg") {
                    extension = ".jpg";
                }
                let dstPathExtension = path.extname(dstPath);
                if (dstPathExtension.toLowerCase() !== extension) {
                    dstPath += extension;
                }
                return dstPath;
            }

            /**
             * 指定したパスをSHA1ハッシュ値の名前に変更する。
             * 変更するのはディレクトリ名ではなくファイル名の拡張子を除いた部分(basename)。
             * 日本語ファイル名がWindowsではShiftJIS、HUISではUTF-8で不整合が生じるため。
             * 
             * @param dstPath {string} 編集後のパスの候補。
             * 
             * @return {string} 補正したパス
             */
            public static getEncodedPath(dstPath: string): string {
                console.log("[getEncodedPath] dstPath = " + dstPath);

                let basename = path.basename(dstPath);
                let extname = path.extname(dstPath);
                let dirname = path.dirname(dstPath);

                const hash = node_crypt.createHash('sha1');

                let date = new Date();
                let unixTimestamp = date.getTime();
                //同名でも、違う名前にするため、時間もハッシュ化の引数にいれる。
                hash.update(basename + unixTimestamp);
                basename = hash.digest('hex');
                console.log("SHA1 basename = " + basename);
                dstPath = dirname + '/' + basename + extname;
                console.log("SHA1 path = " + dstPath);

                return dstPath;
            }

            /**
             * 画像ファイルを読み込み、HTMLImageElement を取得する。
             * file:// の画像を直接 canvas に描画すると canvas が汚染 (tainted) され toDataURL できないため、
             * ファイルの内容から Blob URL を作成して読み込む。
             *
             * @param srcFilePath {string} 読み込む画像ファイルのパス
             * @return {IPromise<HTMLImageElement>} 読み込んだ画像の promise オブジェクト
             */
            public static loadImage(srcFilePath: string): IPromise<HTMLImageElement> {
                let FUNCTION_NAME = TAG + "loadImage : ";
                let df = $.Deferred();
                let promise: IPromise<HTMLImageElement> = CDP.makePromise(df);

                try {
                    let blobUrl = URL.createObjectURL(new Blob([fs.readFileSync(srcFilePath)]));
                    let image = new Image();
                    image.onload = () => {
                        URL.revokeObjectURL(blobUrl);
                        df.resolve(image);
                    };
                    image.onerror = (err) => {
                        URL.revokeObjectURL(blobUrl);
                        console.error(FUNCTION_NAME + "failed to decode " + srcFilePath);
                        df.reject(err);
                    };
                    image.src = blobUrl;
                } catch (err) {
                    console.error(FUNCTION_NAME + err);
                    df.reject();
                }

                return promise;
            }

            /**
             * 編集後の画像のData URLを取得する
             */
            private static getDataUrlOfEditedImage(image: HTMLImageElement, params: IImageEditParams): string {
                // 出力先の canvas。リサイズ指定がない場合は 800x600 (旧 pixi.js 実装の既定サイズ)
                let canvas = document.createElement("canvas");
                canvas.width = 800;
                canvas.height = 600;
                if (params.resize != null) {
                    canvas.width = params.resize.width;
                    canvas.height = params.resize.height;
                }

                // 描画位置とサイズ。リサイズ指定がない場合は原寸で左上に描画する
                let drawArea: IArea = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };

                // リサイズの実行
                if (params.resize) {
                    drawArea = this._resizeImage(image, params.resize, canvas);
                }

                let context = canvas.getContext("2d");
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = "high";

                // グレースケール化
                if (!_.isUndefined(params.grayscale)) {
                    context.filter = "grayscale(" + params.grayscale + ")";
                }

                context.drawImage(image, drawArea.x, drawArea.y, drawArea.w, drawArea.h);

                // 出力する画像の mimeType 設定。
                // デフォルトは image/png。他に image/jpeg を選択できる。
                let imageType = "image/png";
                if (params.imageType && params.imageType === "image/jpeg") {
                    imageType = params.imageType;
                }
                // canvas に描画されているグラフィクスを、指定した mimeType の画像の dataUrl として出力
                let imageDataUrl = canvas.toDataURL(imageType);

                return imageDataUrl;
            }

            /**
             * 画像のリサイズ後の描画領域を計算する。
             * contain かつ padding なしの場合は、canvas を縮小後の画像サイズに合わせる。
             *
             * @return {IArea} canvas 上の描画領域
             */
            private static _resizeImage(image: HTMLImageElement, resize: IImageResizeParams, canvas: HTMLCanvasElement): IArea {
                let imageW = image.naturalWidth,
                    imageH = image.naturalHeight;
                let scaleX = 0 < imageW ? resize.width / imageW : 1,
                    scaleY = 0 < imageH ? resize.height / imageH : 1;
                let resizeMode = resize.mode ? resize.mode : ImageResizeMode.DEFAULT;

                switch (resizeMode) {
                    case ImageResizeMode.CONTAIN:
                        {
                            // scale は X, Y の小さい方を採用する
                            let scale = scaleX < scaleY ? scaleX : scaleY;
                            if (1 < scale && !resize.force) {
                                scale = 1;
                            }

                            let scaledW = imageW * scale,
                                scaledH = imageH * scale;
                            if (resize.padding) {
                                // 余白を維持して中央に配置
                                return { x: (resize.width - scaledW) / 2, y: (resize.height - scaledH) / 2, w: scaledW, h: scaledH };
                            } else {
                                canvas.width = scaledW;
                                canvas.height = scaledH;
                                return { x: 0, y: 0, w: scaledW, h: scaledH };
                            }
                        }
                    case ImageResizeMode.COVER:
                        {
                            // scale は X, Y の大きい方を採用し、はみ出した部分は中央基準で切り取る
                            let scale = scaleX < scaleY ? scaleY : scaleX;

                            let scaledW = imageW * scale,
                                scaledH = imageH * scale;
                            return { x: (resize.width - scaledW) / 2, y: (resize.height - scaledH) / 2, w: scaledW, h: scaledH };
                        }

                    // stretch
                    default:
                        {
                            return { x: 0, y: 0, w: imageW * scaleX, h: imageH * scaleY };
                        }
                }
            }
        }
    }
}
