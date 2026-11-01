HUIS UI CREATOR %VERSION% (Windows 版)
====================================

HUIS REMOTE CONTROLLER のリモコン画面を PC で作成・編集し、本体へ転送するアプリケーションです。

本パッケージは、ソニー株式会社が公開した HUIS UI CREATOR のソースコードをもとに、
使用しているライブラリを更新してビルドした非公式版です。
ソニー株式会社への本パッケージに関するお問い合わせはご遠慮ください。

ソースコード: https://github.com/nmori/huis-ui-creator


■ 動作環境

  - Windows 10 / 11 (64 ビット)
  - HUIS REMOTE CONTROLLER (付属の microUSB ケーブルで PC と接続)


■ 使い方

  1. zip ファイルを任意のフォルダに展開します。
     (zip のまま実行しないでください)
  2. HUIS を PC に接続します。
  3. 展開したフォルダ内の「HUIS UI CREATOR.exe」を起動します。
     起動時に HUIS のリモコン情報が PC と同期されます。1 分以上かかることがあります。
  4. 編集を終えたら「保存して Home に戻る」で HUIS へ転送されます。
  5. PC から HUIS を取り外すと、HUIS 本体で編集内容が反映されます。

  初回起動時に Windows SmartScreen の警告が表示される場合は、
  「詳細情報」→「実行」を選択してください (本パッケージにはコード署名がありません)。


■ 対応している HUIS のソフトウェアのバージョン

  HUIS のソフトウェアが 4.0.0 以上であれば使用できます。
  以下の機能は、接続している HUIS のバージョンに応じて自動的に出しわけられます。

    機能                                                       必要なバージョン
    ---------------------------------------------------------  ----------------
    リモコンの作成・編集、マクロ、コピー＆ペースト、ラベル色      4.0.0 以上
    本体の色設定 (白/黒) の反映、プリセットリモコンのインポート    4.2.0 以上
    ジャンプボタン                                               4.3.0 以上
    お気に入り待受画面の設定                                     4.6.0 以上
    テーマ                                                       5.0.0 以上

  ※ 5.0.0 未満の HUIS での動作は確認できていません。


■ ご注意

  - HUIS へ転送する前に、エクスプローラーで HUIS のドライブの中身をすべて
    PC にコピーしてバックアップを取っておくことをおすすめします。
    万一リモコンが正しく表示されなくなった場合も、元の状態に戻せます。
  - 転送中や同期中は HUIS を取り外さないでください。
  - PC 側の作業用データは %APPDATA%\Garage に保存されます。


■ ライセンス

  本ソフトウェアは Apache License 2.0 で提供されます。
  本ソフトウェアおよび同梱しているソフトウェアのライセンスは licenses フォルダにあります。

    HUIS-UI-CREATOR-LICENSE.txt   HUIS UI CREATOR (Apache License 2.0)
    THIRD-PARTY-LICENSES.txt      同梱しているライブラリ (Electron, jQuery など)
    Electron-LICENSE.txt          Electron (MIT License)
    LICENSES.chromium.html        Electron に含まれる Chromium などのライセンス
    NotoSansCJKjp-LICENSE.txt     Noto Sans CJK JP フォント (SIL Open Font License 1.1)

  本ソフトウェアは「現状のまま」提供され、明示・黙示を問わずいかなる保証もありません。
