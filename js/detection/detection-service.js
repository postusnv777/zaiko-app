// AI判定サービス - Strategy Pattern でエンジン切替
export class DetectionService {
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

    if (!engine.isAvailable()) {
      throw new Error(`エンジン "${engineName}" は利用できません`);
    }

    await engine.initialize();
    this.currentEngine = engine;
  }

  /** 判定実行 */
  async detect(image) {
    if (!this.currentEngine) {
      throw new Error('エンジンが初期化されていません');
    }
    return this.currentEngine.detect(image);
  }

  /** 利用可能なエンジン一覧 */
  getAvailableEngines() {
    return [...this.engines.entries()]
      .filter(([_, engine]) => engine.isAvailable())
      .map(([name]) => name);
  }

  /** 現在のエンジン名 */
  getCurrentEngineName() {
    return this.currentEngine ? this.currentEngine.name : null;
  }
}
