// ローカルAI判定エンジン - TensorFlow.js + COCO-SSD
export class LocalEngine {
  constructor() {
    this.name = 'local';
    this.model = null;
    this.initialized = false;
  }

  /** WebGL対応チェック */
  isAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  }

  /** モデル読み込み */
  async initialize() {
    if (this.initialized && this.model) return;

    // TensorFlow.js と COCO-SSD を動的読み込み
    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');

    // モデルロード
    this.model = await window.cocoSsd.load();
    this.initialized = true;
  }

  /** 画像から物品を判定 */
  async detect(image) {
    if (!this.model) throw new Error('モデルが読み込まれていません');

    // img要素から判定
    const predictions = await this.model.detect(image);

    // 信頼度0.4以上のみ、DetectionResult形式に変換
    return predictions
      .filter(p => p.score >= 0.4)
      .map(p => ({
        label: this.translateLabel(p.class),
        confidence: p.score,
        category: this.guessCategory(p.class)
      }))
      // 重複ラベルを除去（信頼度高い方を残す）
      .filter((item, index, self) =>
        self.findIndex(i => i.label === item.label) === index
      );
  }

  /** リソース解放 */
  dispose() {
    this.model = null;
    this.initialized = false;
  }

  /** スクリプト動的読み込み */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      // 既に読み込み済みならスキップ
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /** COCO-SSDラベル → 日本語 */
  translateLabel(label) {
    const map = {
      'person': '人',
      'bicycle': '自転車',
      'car': '車',
      'motorcycle': 'バイク',
      'bottle': 'ボトル',
      'wine glass': 'ワイングラス',
      'cup': 'カップ',
      'fork': 'フォーク',
      'knife': 'ナイフ',
      'spoon': 'スプーン',
      'bowl': 'ボウル',
      'banana': 'バナナ',
      'apple': 'りんご',
      'sandwich': 'サンドイッチ',
      'orange': 'オレンジ',
      'broccoli': 'ブロッコリー',
      'carrot': 'にんじん',
      'hot dog': 'ホットドッグ',
      'pizza': 'ピザ',
      'donut': 'ドーナツ',
      'cake': 'ケーキ',
      'chair': '椅子',
      'couch': 'ソファ',
      'potted plant': '観葉植物',
      'bed': 'ベッド',
      'dining table': 'テーブル',
      'toilet': 'トイレ',
      'tv': 'テレビ',
      'laptop': 'ノートPC',
      'mouse': 'マウス',
      'remote': 'リモコン',
      'keyboard': 'キーボード',
      'cell phone': 'スマホ',
      'microwave': '電子レンジ',
      'oven': 'オーブン',
      'toaster': 'トースター',
      'sink': '流し台',
      'refrigerator': '冷蔵庫',
      'book': '本',
      'clock': '時計',
      'vase': '花瓶',
      'scissors': 'ハサミ',
      'teddy bear': 'ぬいぐるみ',
      'hair drier': 'ドライヤー',
      'toothbrush': '歯ブラシ'
    };
    return map[label] || label;
  }

  /** カテゴリ推定 */
  guessCategory(label) {
    const food = ['banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot',
                  'hot dog', 'pizza', 'donut', 'cake', 'bottle', 'wine glass', 'cup', 'bowl'];
    const daily = ['toothbrush', 'hair drier', 'scissors', 'toilet'];

    if (food.includes(label)) return '食品';
    if (daily.includes(label)) return '日用品';
    return 'その他';
  }
}
