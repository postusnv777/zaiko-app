# 在庫チェックアプリ — 設計書

#[[file:requirements.md]]

## アーキテクチャ概要

```
+------------------------------------------------------+
|                     UI Layer                          |
|  +----------+  +----------+  +----------------+      |
|  | Camera   |  | Inventory|  | ShoppingList   |      |
|  +----+-----+  +----+-----+  +-------+--------+      |
|       |              |                |               |
+-------+--------------+----------------+---------------+
|       |        Service Layer          |               |
|       v              |                |               |
|  +--------------------------------------------+      |
|  |    DetectionService (Strategy)              |      |
|  |  +-----------+    +----------------+       |      |
|  |  | Local     |    | Cloud          |       |      |
|  |  | (TF.js)  |    | (Gemini/Vision)|       |      |
|  |  +-----------+    +----------------+       |      |
|  +--------------------------------------------+      |
|                      |                |               |
|                      v                v               |
|  +--------------------------------------------+      |
|  |         InventoryService                    |      |
|  +--------------------------------------------+      |
|                      |                               |
|                      v                               |
|  +--------------------------------------------+      |
|  |       ShoppingListService                   |      |
|  +--------------------------------------------+      |
|                      |                               |
+----------------------+-------------------------------+
|                Data Layer                             |
|  +--------------+    +------------------------+      |
|  | Firestore    |    | localStorage           |      |
|  +--------------+    +------------------------+      |
+------------------------------------------------------+

UI --> Service mapping:
  Camera       --> DetectionService --> InventoryService
  Inventory    --> InventoryService
  ShoppingList --> ShoppingListService <--> InventoryService
```

## ファイル構成

```
zaiko-app/
├── index.html              # メインHTML（UI全体）
├── js/
│   ├── app.js              # エントリポイント、画面切替
│   ├── detection/
│   │   ├── detection-service.js   # Strategy管理（エンジン切替）
│   │   ├── local-engine.js        # TensorFlow.js COCO-SSD
│   │   └── cloud-engine.js        # Gemini API / Cloud Vision
│   ├── inventory-service.js       # 在庫CRUD
│   ├── shopping-service.js        # 買い物リストCRUD
│   └── firebase-config.js         # Firebase初期化・認証
├── css/
│   └── style.css           # スタイル
├── manifest.json           # PWA設定
└── service-worker.js       # オフライン対応
```

**判断根拠**: 単一HTMLだと1500行を超える見込みのため、JS/CSSを分離する。
ただしビルドツールは使わず、ES Modulesの`<script type="module">`で読み込む。

## AI判定エンジン — Strategy Pattern

### インターフェース定義

```javascript
// detection-service.js

/**
 * 判定エンジンの共通インターフェース
 * すべてのエンジンはこの形式に従う
 */
const EngineInterface = {
  /** エンジン名 */
  name: '',
  /** エンジンの初期化（モデル読み込み等） */
  async initialize() {},
  /** 画像から物品を判定する
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<DetectionResult[]>}
   */
  async detect(image) {},
  /** エンジンが利用可能か */
  isAvailable() {},
  /** リソース解放 */
  dispose() {}
};

/**
 * @typedef {Object} DetectionResult
 * @property {string} label - 判定された品名
 * @property {number} confidence - 信頼度 (0.0〜1.0)
 * @property {string} [category] - カテゴリ推定（食品/日用品/その他）
 */
```

### DetectionService（エンジン切替管理）

```javascript
class DetectionService {
  constructor() {
    this.engines = new Map();
    this.currentEngine = null;
  }

  /** エンジンを登録 */
  registerEngine(engine) {
    this.engines.set(engine.name, engine);
  }

  /** エンジンを切り替え */
  async switchEngine(engineName) {
    if (this.currentEngine) {
      this.currentEngine.dispose();
    }
    const engine = this.engines.get(engineName);
    if (!engine) throw new Error(`エンジン "${engineName}" が見つかりません`);
    await engine.initialize();
    this.currentEngine = engine;
  }

  /** 判定実行 */
  async detect(image) {
    if (!this.currentEngine) throw new Error('エンジンが初期化されていません');
    return this.currentEngine.detect(image);
  }

  /** 利用可能なエンジン一覧 */
  getAvailableEngines() {
    return [...this.engines.entries()]
      .filter(([_, engine]) => engine.isAvailable())
      .map(([name]) => name);
  }
}
```

### エンジン切替のフロー

1. 初回起動時: ローカルエンジン（TF.js）を試行
2. ローカルが利用不可 or ユーザーが切替: クラウドエンジンへフォールバック
3. 設定画面でユーザーが手動切替可能
4. 切替時にはクラウド使用の注意（画像送信）を表示

## データモデル（Firestore）

### コレクション構成

```
firestore/
├── users/{uid}/
│   ├── inventory/          # 在庫アイテム
│   │   └── {itemId}/
│   └── shoppingList/       # 買い物リスト
│       └── {itemId}/
└── (kaji-appの既存コレクション)
```

**注意**: kaji-appと同じFirebaseプロジェクトを使うため、コレクション名で棲み分ける。

### inventory ドキュメント

```javascript
{
  id: "auto-generated",       // Firestoreの自動ID
  name: "牛乳",              // 品名
  category: "食品",           // "食品" | "日用品" | "その他"
  status: "あり",             // "あり" | "残りわずか" | "なし"
  lastCheckedAt: Timestamp,   // 最終確認日時
  createdAt: Timestamp,       // 作成日時
  updatedAt: Timestamp        // 更新日時
}
```

### shoppingList ドキュメント

```javascript
{
  id: "auto-generated",
  name: "牛乳",              // 品名
  category: "食品",           // カテゴリ
  purchased: false,           // 購入済みフラグ
  sourceItemId: "xxx",        // 元の在庫アイテムID（自動生成の場合）
  addedAt: Timestamp,         // リスト追加日時
  purchasedAt: Timestamp|null // 購入日時
}
```

## UI設計

### 画面構成（3画面 + 設定）

```
┌─────────────────────────┐
│  ヘッダー: 在庫チェック    │
├─────────────────────────┤
│                         │
│     [メイン画面]         │
│                         │
├─────────────────────────┤
│  📷    📦    🛒    ⚙️   │
│ 撮影  在庫  買物  設定   │
└─────────────────────────┘
```

### 1. 撮影画面（📷）

- カメラプレビュー or 画像選択ボタン
- 撮影/選択後 → AI判定実行 → 結果表示
- 結果から「在庫に追加」ボタン

### 2. 在庫リスト画面（📦）

- カテゴリ別にグループ表示
- 各アイテムの状態を色分け表示
  - あり: 緑
  - 残りわずか: オレンジ
  - なし: 赤
- スワイプ or ボタンで状態変更
- 「なし」のアイテムに「買い物リストへ追加」ボタン

### 3. 買い物リスト画面（🛒）

- 未購入アイテム一覧
- タップでチェック（購入済み）
- 購入済みにすると在庫の状態を「あり」に更新

### 4. 設定画面（⚙️）

- AI判定エンジンの選択（ローカル / クラウド）
- クラウド使用時のAPIキー入力（localStorageに保存）
- データクリア

### UIテーマ

kaji-appとの将来統合を見据え、共通のデザイン変数を使用：

```css
:root {
  --primary: #10b981;        /* 在庫アプリのテーマカラー（緑系） */
  --primary-dark: #059669;
  --bg: #f4f6fb;             /* kaji-appと共通 */
  --card: #ffffff;
  --text: #1a1a2e;
  --muted: #6b7280;
  --border: #e5e7eb;
  --status-ok: #22c55e;
  --status-low: #f97316;
  --status-none: #ef4444;
  --radius: 12px;
  --shadow: 0 2px 8px rgba(0,0,0,0.08);
}
```

## オフライン戦略

| データ | オンライン | オフライン |
|--------|-----------|-----------|
| 在庫リスト | Firestoreリアルタイム同期 | localStorageキャッシュで閲覧可 |
| 買い物リスト | Firestoreリアルタイム同期 | localStorageキャッシュで閲覧可 |
| AI判定（ローカル） | TF.jsモデルをキャッシュ済みなら動作 | Service Workerでモデルキャッシュ |
| AI判定（クラウド） | API呼び出し | 利用不可（エラー表示） |

## セキュリティ設計

### 画像データの取り扱い

- ローカルAI: 画像はCanvasに描画 → 判定 → 即破棄（メモリ上のみ）
- クラウドAI: Base64エンコードして送信 → レスポンス受領後に破棄
- いずれの場合も画像はFirestoreに保存しない

### Firestoreセキュリティルール

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/inventory/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/shoppingList/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### APIキー管理

- クラウドAI用のAPIキーはlocalStorageに保存（ユーザー端末内）
- Firebaseフロントエンド用apiKeyはコード内に記述（公開前提、リファラー制限で防御）

## 将来の統合設計

### kaji-appとの統合パス

1. **Phase 1（現在）**: 独立アプリとして開発
2. **Phase 2**: kaji-appにハブ画面を追加、zaiko-appへリンク遷移
3. **Phase 3（任意）**: 同一リポジトリにモジュールとして統合

### 統合を容易にする設計方針

- 同じFirebaseプロジェクト・同じ認証を使用
- CSS変数名の命名規則をkaji-appと合わせる（`--bg`, `--card`等共通）
- JSはES Modulesで書き、統合時にimportで取り込める構造にする
- Firestoreコレクションは`users/{uid}/`配下で棲み分け済み
