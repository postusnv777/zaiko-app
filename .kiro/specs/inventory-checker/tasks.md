# 在庫チェックアプリ — 実装タスク

#[[file:requirements.md]]
#[[file:design.md]]

## Phase 1: プロジェクト基盤

### Task 1.1: プロジェクトスケルトン作成
- [ ] `index.html` — 基本HTML構造（ヘッダー、メイン、ボトムナビ）
- [ ] `css/style.css` — CSS変数定義、レイアウト基盤、ボトムナビスタイル
- [ ] `js/app.js` — 画面切替ロジック（タブナビゲーション）
- [ ] `manifest.json` — PWA設定
- [ ] `service-worker.js` — 基本的なキャッシュ戦略（App Shell）

**完了条件**: ブラウザで4画面（撮影/在庫/買物/設定）がタブ切替で表示される

### Task 1.2: Firebase初期化・認証
- [ ] `js/firebase-config.js` — Firebase SDK読み込み（CDN）、初期化
- [ ] Googleログイン実装（サインイン/サインアウト）
- [ ] 認証状態に応じたUI切替（未ログイン時はログインボタン表示）
- [ ] kaji-appと同じFirebaseプロジェクトの設定を使用

**完了条件**: Googleアカウントでログイン/ログアウトが動作する

---

## Phase 2: 在庫管理（コア機能）

### Task 2.1: 在庫リストUI
- [ ] 在庫リスト画面のHTML/CSS実装
- [ ] カテゴリ別グループ表示（食品/日用品/その他）
- [ ] 状態の色分け表示（あり=緑、残りわずか=オレンジ、なし=赤）
- [ ] アイテム追加モーダル（品名、カテゴリ、状態を入力）
- [ ] アイテム状態変更UI（タップで状態トグル）
- [ ] アイテム削除機能

**完了条件**: 手動でアイテムを追加・状態変更・削除でき、カテゴリ別に表示される

### Task 2.2: Firestore連携（在庫）
- [ ] `js/inventory-service.js` — CRUD操作の実装
  - `addItem(item)` — アイテム追加
  - `updateItem(id, data)` — アイテム更新
  - `deleteItem(id)` — アイテム削除
  - `subscribeToInventory(callback)` — リアルタイム購読
- [ ] リアルタイムリスナーでUI自動更新
- [ ] localStorageへのキャッシュ（オフライン対応）

**完了条件**: 追加したアイテムがFirestoreに保存され、別端末でもリアルタイム反映される

---

## Phase 3: 買い物リスト

### Task 3.1: 買い物リストUI
- [ ] 買い物リスト画面のHTML/CSS実装
- [ ] 未購入/購入済みの表示切替
- [ ] タップで購入済みチェック
- [ ] 手動アイテム追加
- [ ] アイテム削除

**完了条件**: 買い物リストの表示・チェック・追加・削除が動作する

### Task 3.2: Firestore連携（買い物リスト）
- [ ] `js/shopping-service.js` — CRUD操作の実装
  - `addToList(item)` — リストに追加
  - `markPurchased(id)` — 購入済みにする
  - `removeFromList(id)` — リストから削除
  - `subscribeToShoppingList(callback)` — リアルタイム購読
- [ ] 購入済みにしたとき、在庫アイテムの状態を「あり」に更新
- [ ] 在庫画面の「なし」「残りわずか」アイテムから買い物リストへ追加する導線

**完了条件**: 買い物リストとFirestoreが同期し、購入済み操作で在庫状態も更新される

---

## Phase 4: カメラ・AI判定

### Task 4.1: カメラ撮影機能
- [ ] 撮影画面のHTML/CSS実装
- [ ] `getUserMedia` によるカメラプレビュー表示
- [ ] 撮影ボタンでCanvasにキャプチャ
- [ ] ギャラリーからの画像選択（`<input type="file" accept="image/*">`）
- [ ] 撮影/選択した画像のプレビュー表示

**完了条件**: カメラ撮影 or ギャラリー選択した画像がプレビューに表示される

### Task 4.2: AI判定エンジン基盤（Strategy Pattern）
- [ ] `js/detection/detection-service.js` — DetectionService クラス実装
  - エンジン登録（registerEngine）
  - エンジン切替（switchEngine）
  - 判定実行（detect）
  - 利用可能エンジン一覧（getAvailableEngines）
- [ ] DetectionResult型の定義（label, confidence, category）
- [ ] 判定中のローディング表示

**完了条件**: DetectionServiceが動作し、エンジンの登録・切替・実行が行える

### Task 4.3: ローカルエンジン実装（TensorFlow.js）
- [ ] `js/detection/local-engine.js` — LocalEngine クラス
- [ ] TensorFlow.js + COCO-SSD モデルをCDNから読み込み
- [ ] `initialize()` — モデルロード
- [ ] `detect(image)` — 物体検出実行、DetectionResult形式で返却
- [ ] `isAvailable()` — WebGL対応チェック
- [ ] 検出ラベルの日本語マッピング（bottle→ボトル、apple→りんご等）

**完了条件**: カメラ画像からローカルで物体を検出し、日本語ラベルで結果表示される

### Task 4.4: クラウドエンジン実装（Gemini API）
- [ ] `js/detection/cloud-engine.js` — CloudEngine クラス
- [ ] Gemini API（無料枠）への画像送信・結果取得
- [ ] プロンプト設計（「この画像に写っている食品・日用品を列挙してください」）
- [ ] レスポンスのパース → DetectionResult形式へ変換
- [ ] APIキーの設定UI（設定画面から入力、localStorageに保存）
- [ ] 画像送信時の確認ダイアログ表示

**完了条件**: Gemini APIで画像を判定し、結果がDetectionResult形式で返る

### Task 4.5: 判定結果 → 在庫登録の連携
- [ ] 判定結果の一覧表示UI（チェックボックス付き）
- [ ] 選択したアイテムを一括で在庫に追加する機能
- [ ] 既存アイテムとの重複チェック（同名アイテムがあれば状態更新）
- [ ] 追加完了のフィードバック表示

**完了条件**: AI判定結果から選択して在庫リストに追加でき、重複は状態更新される

---

## Phase 5: 設定・仕上げ

### Task 5.1: 設定画面
- [ ] AI判定エンジンの選択UI（ラジオボタン: ローカル/クラウド）
- [ ] クラウド使用時のAPIキー入力フィールド
- [ ] クラウド使用時の注意表示（「画像がサーバーに送信されます」）
- [ ] ログアウトボタン
- [ ] データクリア機能（確認ダイアログ付き）

**完了条件**: エンジン切替・APIキー設定・ログアウトが設定画面から操作できる

### Task 5.2: オフライン対応強化
- [ ] Service Workerのキャッシュ戦略見直し（静的アセット + TF.jsモデル）
- [ ] オフライン時のUI表示（同期状態インジケータ）
- [ ] Firestore永続化キャッシュの有効化
- [ ] オフライン時の操作制限（クラウドAI無効化等）

**完了条件**: オフラインでも在庫・買い物リストが閲覧でき、ローカルAIが動作する

### Task 5.3: PWA仕上げ・デプロイ
- [ ] manifest.jsonの最終調整（アイコン作成、テーマカラー）
- [ ] GitHub Pagesへのデプロイ設定
- [ ] モバイル端末での動作確認（カメラ権限、PWAインストール）
- [ ] パフォーマンス確認（AI判定5秒以内の目標）

**完了条件**: PWAとしてインストール可能で、撮影→判定→在庫追加→買い物リストの一連のフローが動作する

---

## 実装順序の方針

```
Phase 1（基盤）→ Phase 2（在庫）→ Phase 3（買い物）→ Phase 4（AI）→ Phase 5（仕上げ）
```

- Phase 1〜3 で「手動入力の在庫管理アプリ」として使える状態にする
- Phase 4 でAI判定を追加（段階的に価値を積み上げる）
- Phase 5 で品質向上・デプロイ

各Phaseの完了時点でデプロイ可能な状態を維持する（常に動く状態でコミット）。
