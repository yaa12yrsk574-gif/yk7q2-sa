# 工房・狩り場

GitHub main が正本。`index.html` を入口に、工房と狩り場を毎回一緒に動かす。ビルドは不要。HTTP サーバーでこのディレクトリを配信する。

## 編集する場所

| 内容 | ファイル |
| --- | --- |
| 起動・工房と狩り場の切替 | `index.html`, `shell.js`, `shell.css` |
| 骨の形・ポーズ補間・軌道・歩行性能 | `shared/bones.js` |
| 種族の骨・動きのお手本 | `shared/templates.js` |
| 保存キー・初期データ形式 | `shared/project-data.js` |
| 作品保存・クラウド同期 | `shared/storage.js` |
| 共通のマウス優先判定・選択追加解除 | `shared/input.js` |
| 工房のモード操作・表示・作品管理 UI | `workshop/app.js`, `workshop.html`, `workshop/style.css` |
| 狩り場の操作・戦闘・相棒 | `hunting/app.js`, `hunting.html`, `hunting/style.css` |
| 既存の Three.js（変更せず抽出） | `vendor/three.min.js` |

工房と狩り場は同じ共有ファイルを読む。骨計算の状態は各画面ごとに渡すので、狩り場の敵・相棒・工房の編集中データを混ぜない。iframe は同一オリジンの別 HTML。保存キーと JSON 形式は既存のまま。

左＝描画・操作、右＝選択。入力ファイルは共通ルール、選択対象と左の具体的動作は各画面が担当する。細部を直すときに vendor や狩り場を丸ごと読む必要はない。工房内部の各モードはまだ同じ app.js 内にあり、必要に応じてさらに小さくできる。

## 検証

```
node scripts/version-assets.cjs
node tests/core.cjs
node tests/input-guards.cjs
```

変更後は `version-assets.cjs` で参照 URL の内容ハッシュを更新し、更新された HTML と shell.js も同時にコミットする。ブラウザの古いキャッシュと新しいコードの混在を防ぐ。ビルドや依存パッケージのインストールは不要。

`core-baseline.json` は分割前 main `115fb729a4ca83b9ac3740e9c8f79a1570effde7` の実計算結果のハッシュ。種族の形・各動作の全コマ・歩行性能、自由制作の変形・軌道・中割りを比較する。入力テストは骨削除処理の直接呼出しも含む。テストだけで実機確認済みとはしない。

反映時は必要なファイルを一つのコミットに揃え、main の試遊ページで工房→保存→狩り場→工房、細部の右選択／左調整、既存作品の読み込みを確認する。新仕様はユウヤの決定後に追加する。
