// カメラ管理
export class CameraManager {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.canvasEl = null;
  }

  /** カメラ起動 */
  async start() {
    this.videoEl = document.getElementById('camera-preview');
    this.canvasEl = document.getElementById('camera-canvas');

    if (this.stream) return; // 既に起動中

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      this.videoEl.srcObject = this.stream;
    } catch (err) {
      console.warn('カメラ起動失敗:', err);
      // カメラが使えない場合は画像選択のみ
    }
  }

  /** カメラ停止 */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  /** 撮影（Canvasにキャプチャ） */
  capture() {
    if (!this.videoEl || !this.stream) return null;

    const canvas = this.canvasEl;
    const video = this.videoEl;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.85);
  }
}
