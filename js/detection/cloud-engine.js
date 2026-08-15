// クラウドAI判定エンジン - Gemini API
export class CloudEngine {
  constructor() {
    this.name = 'cloud';
    this.apiKey = '';
    this.initialized = false;
  }

  /** 常に利用可能（オンラインかつAPIキーがあれば） */
  isAvailable() {
    return navigator.onLine;
  }

  /** 初期化 */
  async initialize() {
    this.apiKey = localStorage.getItem('zaiko-gemini-key') || '';
    this.initialized = true;
  }

  /** APIキー設定 */
  setApiKey(key) {
    this.apiKey = key;
  }

  /** 画像から物品を判定 */
  async detect(image) {
    if (!this.apiKey) {
      throw new Error('APIキーが設定されていません。設定画面で入力してください。');
    }

    // 画像送信の確認
    if (!confirm('画像をGoogleサーバーに送信してAI判定を行います。続行しますか？')) {
      throw new Error('ユーザーがキャンセルしました');
    }

    // img要素からBase64を取得
    const base64Data = this.getBase64FromImage(image);

    // Gemini API呼び出し
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{
        parts: [
          {
            text: `この画像に写っている食品・日用品・生活用品を判定してください。
以下のJSON形式で回答してください。それ以外のテキストは不要です。
[{"label": "品名（日本語）", "confidence": 0.0〜1.0の信頼度, "category": "食品" or "日用品" or "その他"}]
- 家具や建物など在庫管理に不要なものは除外してください
- 信頼度は推定で構いません`
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`API エラー: ${response.status} ${errData.error?.message || ''}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /** リソース解放 */
  dispose() {
    this.initialized = false;
  }

  /** img要素からBase64データを抽出 */
  getBase64FromImage(image) {
    // data:image/jpeg;base64,xxxx 形式なら直接抽出
    if (image.src && image.src.startsWith('data:')) {
      return image.src.split(',')[1];
    }

    // Canvas経由で変換
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1];
  }

  /** Geminiレスポンスをパース */
  parseResponse(data) {
    try {
      const text = data.candidates[0].content.parts[0].text;
      // JSONブロックを抽出（```json ... ``` で囲まれている場合に対応）
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const items = JSON.parse(jsonMatch[0]);
      return items.map(item => ({
        label: item.label || item.name || '不明',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
        category: item.category || 'その他'
      }));
    } catch (e) {
      console.warn('Geminiレスポンスのパースに失敗:', e);
      return [];
    }
  }
}
