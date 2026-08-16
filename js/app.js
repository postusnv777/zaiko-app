// 在庫チェックアプリ - エントリポイント
import { initAuth, signIn, signOut, onAuthChange } from './firebase-config.js';
import { InventoryService } from './inventory-service.js';
import { ShoppingService } from './shopping-service.js';
import { CameraManager } from './camera-manager.js';
import { DetectionService } from './detection/detection-service.js';
import { LocalEngine } from './detection/local-engine.js';
import { CloudEngine } from './detection/cloud-engine.js';

// 状態管理
const state = {
  currentPage: 'camera',
  user: null,
  inventoryItems: [],
  shoppingItems: []
};

// サービス初期化
const inventoryService = new InventoryService();
const shoppingService = new ShoppingService(inventoryService);
const cameraManager = new CameraManager();
const detectionService = new DetectionService();

// --- 画面切替 ---
function switchPage(pageName) {
  state.currentPage = pageName;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageName}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
  // FABは在庫画面でのみ表示
  const fab = document.getElementById('fab-add');
  fab.style.display = pageName === 'inventory' ? 'flex' : 'none';
  // カメラ画面に切替時にカメラ起動
  if (pageName === 'camera') {
    cameraManager.start();
  } else {
    cameraManager.stop();
  }
}

// --- 認証UI ---
function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('user-avatar').src = user.photoURL || '';
  document.getElementById('setting-user-name').textContent = user.displayName || user.email;
  // サービス開始
  inventoryService.subscribe(user.uid, renderInventory);
  shoppingService.subscribe(user.uid, renderShopping);
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  inventoryService.unsubscribe();
  shoppingService.unsubscribe();
  cameraManager.stop();
}

// --- 在庫リスト描画 ---
function renderInventory(items) {
  state.inventoryItems = items;
  const container = document.getElementById('inventory-list');
  const empty = document.getElementById('inventory-empty');

  if (items.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // カテゴリ別にグループ化
  const groups = { '食品': [], '日用品': [], 'その他': [] };
  items.forEach(item => {
    const cat = groups[item.category] ? item.category : 'その他';
    groups[cat].push(item);
  });

  let html = '';
  for (const [category, categoryItems] of Object.entries(groups)) {
    if (categoryItems.length === 0) continue;
    html += `<div class="category-group">`;
    html += `<div class="category-label">${category}</div>`;
    categoryItems.forEach(item => {
      const statusClass = item.status === 'あり' ? 'status-ok' : item.status === '残りわずか' ? 'status-low' : 'status-none';
      const date = item.lastCheckedAt ? new Date(item.lastCheckedAt.seconds * 1000).toLocaleDateString('ja-JP') : '';
      html += `
        <div class="inventory-item" data-id="${item.id}">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="status-badge ${statusClass}">${item.status}</span>
          <span class="item-date">${date}</span>
        </div>`;
    });
    html += `</div>`;
  }
  container.innerHTML = html;

  // アイテムタップで状態変更メニュー
  container.querySelectorAll('.inventory-item').forEach(el => {
    el.addEventListener('click', () => showItemActions(el.dataset.id));
  });
}

// --- 買い物リスト描画 ---
function renderShopping(items) {
  state.shoppingItems = items;
  const container = document.getElementById('shopping-list');
  const empty = document.getElementById('shopping-empty');

  if (items.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const unpurchased = items.filter(i => !i.purchased);
  const purchased = items.filter(i => i.purchased);

  let html = '';
  [...unpurchased, ...purchased].forEach(item => {
    const cls = item.purchased ? 'shopping-item purchased' : 'shopping-item';
    html += `
      <div class="${cls}" data-id="${item.id}">
        <div class="shopping-check">${item.purchased ? '✓' : ''}</div>
        <span class="item-name">${escapeHtml(item.name)}</span>
      </div>`;
  });
  container.innerHTML = html;

  // タップで購入済みトグル
  container.querySelectorAll('.shopping-item').forEach(el => {
    el.addEventListener('click', async () => {
      const item = items.find(i => i.id === el.dataset.id);
      if (item && !item.purchased) {
        await shoppingService.markPurchased(state.user.uid, item.id, item.sourceItemId);
        showToast('購入済みにしました');
      }
    });
  });
}

// --- アイテムアクション ---
let actionTargetId = null;

function showItemActions(itemId) {
  const item = state.inventoryItems.find(i => i.id === itemId);
  if (!item) return;
  actionTargetId = itemId;
  document.getElementById('action-item-name').textContent = `${item.name}（${item.status}）`;
  document.getElementById('modal-item-actions').classList.add('active');
}

function closeItemActions() {
  document.getElementById('modal-item-actions').classList.remove('active');
  actionTargetId = null;
}

function handleActionStatus() {
  const item = state.inventoryItems.find(i => i.id === actionTargetId);
  if (!item) return;
  const statuses = ['あり', '残りわずか', 'なし'];
  const nextStatus = statuses[(statuses.indexOf(item.status) + 1) % statuses.length];
  inventoryService.updateItem(state.user.uid, actionTargetId, {
    status: nextStatus,
    lastCheckedAt: new Date()
  });
  showToast(`${item.name}: ${nextStatus}`);
  closeItemActions();
}

function handleActionEdit() {
  const item = state.inventoryItems.find(i => i.id === actionTargetId);
  if (!item) return;
  closeItemActions();
  // 編集モーダルを開く
  document.getElementById('edit-item-name').value = item.name;
  document.getElementById('edit-item-category').value = item.category;
  document.getElementById('edit-item-status').value = item.status;
  document.getElementById('modal-edit-item').classList.add('active');
}

async function handleEditSave() {
  const name = document.getElementById('edit-item-name').value.trim();
  const category = document.getElementById('edit-item-category').value;
  const status = document.getElementById('edit-item-status').value;
  if (!name) { alert('品名を入力してください'); return; }

  await inventoryService.updateItem(state.user.uid, actionTargetId, {
    name, category, status, lastCheckedAt: new Date()
  });
  showToast(`${name} を更新しました`);
  document.getElementById('modal-edit-item').classList.remove('active');
  actionTargetId = null;
}

function handleActionShopping() {
  const item = state.inventoryItems.find(i => i.id === actionTargetId);
  if (!item) return;
  shoppingService.addToList(state.user.uid, {
    name: item.name,
    category: item.category,
    sourceItemId: item.id
  });
  showToast(`${item.name} を買い物リストに追加`);
  closeItemActions();
}

function handleActionDelete() {
  const item = state.inventoryItems.find(i => i.id === actionTargetId);
  if (!item) return;
  if (confirm(`「${item.name}」を削除しますか？`)) {
    inventoryService.deleteItem(state.user.uid, actionTargetId);
    showToast(`${item.name} を削除しました`);
  }
  closeItemActions();
}

// --- モーダル ---
function openAddModal() {
  document.getElementById('modal-add-item').classList.add('active');
  document.getElementById('input-item-name').value = '';
  document.getElementById('input-item-name').focus();
}

function closeAddModal() {
  document.getElementById('modal-add-item').classList.remove('active');
}

async function saveNewItem() {
  const name = document.getElementById('input-item-name').value.trim();
  const category = document.getElementById('input-item-category').value;
  const status = document.getElementById('input-item-status').value;

  if (!name) {
    alert('品名を入力してください');
    return;
  }

  await inventoryService.addItem(state.user.uid, { name, category, status });
  closeAddModal();
  showToast(`${name} を追加しました`);
}

// --- カメラ・AI判定 ---
async function handleCapture() {
  const imageData = cameraManager.capture();
  if (imageData) {
    document.getElementById('camera-captured').src = imageData;
    document.getElementById('camera-captured').style.display = 'block';
    document.getElementById('camera-preview').style.display = 'none';
    document.getElementById('btn-capture').style.display = 'none';
    document.getElementById('btn-retake').style.display = 'inline-flex';
    document.getElementById('btn-detect').style.display = 'block';
    cameraManager.stop();
  }
}

function handleRetake() {
  document.getElementById('camera-captured').style.display = 'none';
  document.getElementById('camera-preview').style.display = 'block';
  document.getElementById('btn-capture').style.display = 'inline-flex';
  document.getElementById('btn-retake').style.display = 'none';
  document.getElementById('btn-detect').style.display = 'none';
  document.getElementById('detection-results').style.display = 'none';
  cameraManager.start();
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('camera-captured').src = ev.target.result;
    document.getElementById('camera-captured').style.display = 'block';
    document.getElementById('camera-preview').style.display = 'none';
    document.getElementById('btn-capture').style.display = 'none';
    document.getElementById('btn-retake').style.display = 'inline-flex';
    document.getElementById('btn-detect').style.display = 'block';
    cameraManager.stop();
  };
  reader.readAsDataURL(file);
}

async function handleDetect() {
  const img = document.getElementById('camera-captured');
  document.getElementById('detection-loading').style.display = 'flex';
  document.getElementById('btn-detect').style.display = 'none';

  try {
    const results = await detectionService.detect(img);
    renderDetectionResults(results);
    updateUsageDisplay();
  } catch (err) {
    alert('判定に失敗しました: ' + err.message);
    document.getElementById('btn-detect').style.display = 'block';
  } finally {
    document.getElementById('detection-loading').style.display = 'none';
  }
}

function renderDetectionResults(results) {
  const container = document.getElementById('detection-list');
  const section = document.getElementById('detection-results');

  if (results.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">アイテムが検出されませんでした</p>';
    section.style.display = 'block';
    return;
  }

  let html = '';
  results.forEach((r, i) => {
    const pct = Math.round(r.confidence * 100);
    html += `
      <div class="detection-item">
        <input type="checkbox" id="det-${i}" checked data-label="${escapeHtml(r.label)}" data-category="${r.category || 'その他'}" />
        <label for="det-${i}" class="label">${escapeHtml(r.label)}</label>
        <span class="confidence">${pct}%</span>
      </div>`;
  });
  container.innerHTML = html;
  section.style.display = 'block';
}

async function handleAddDetected() {
  const checkboxes = document.querySelectorAll('#detection-list input[type="checkbox"]:checked');
  let count = 0;

  for (const cb of checkboxes) {
    const name = cb.dataset.label;
    const category = cb.dataset.category;
    // 重複チェック
    const existing = state.inventoryItems.find(i => i.name === name);
    if (existing) {
      await inventoryService.updateItem(state.user.uid, existing.id, {
        status: 'あり',
        lastCheckedAt: new Date()
      });
    } else {
      await inventoryService.addItem(state.user.uid, { name, category, status: 'あり' });
    }
    count++;
  }

  showToast(`${count}件を在庫に追加しました`);
  handleRetake();
}

// --- 設定 ---
function initSettings() {
  const engineSelect = document.getElementById('setting-engine');
  const cloudSettings = document.getElementById('cloud-settings');
  const savedEngine = localStorage.getItem('zaiko-engine') || 'local';
  const savedApiKey = localStorage.getItem('zaiko-gemini-key') || '';

  engineSelect.value = savedEngine;
  cloudSettings.style.display = savedEngine === 'cloud' ? 'block' : 'none';
  document.getElementById('setting-api-key').value = savedApiKey;
  updateUsageDisplay();

  engineSelect.addEventListener('change', async () => {
    const value = engineSelect.value;
    localStorage.setItem('zaiko-engine', value);
    cloudSettings.style.display = value === 'cloud' ? 'block' : 'none';
    await switchEngine(value);
  });

  document.getElementById('setting-api-key').addEventListener('change', (e) => {
    localStorage.setItem('zaiko-gemini-key', e.target.value);
    if (detectionService.currentEngine && detectionService.currentEngine.name === 'cloud') {
      detectionService.currentEngine.setApiKey(e.target.value);
    }
  });
}

function updateUsageDisplay() {
  const count = CloudEngine.getUsageToday();
  const el = document.getElementById('api-usage-count');
  if (el) el.textContent = count;
}

async function switchEngine(engineName) {
  try {
    await detectionService.switchEngine(engineName);
    showToast(`エンジン: ${engineName === 'local' ? 'ローカル' : 'クラウド'}`);
  } catch (err) {
    showToast('エンジン切替に失敗: ' + err.message);
  }
}

// --- ユーティリティ ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- 初期化 ---
async function init() {
  // Firebase認証
  initAuth();
  onAuthChange((user) => {
    state.user = user;
    if (user) {
      showApp(user);
    } else {
      showLogin();
    }
  });

  // 判定エンジン登録
  detectionService.registerEngine(new LocalEngine());
  detectionService.registerEngine(new CloudEngine());

  // 保存済みエンジンで初期化
  const savedEngine = localStorage.getItem('zaiko-engine') || 'local';
  try {
    await detectionService.switchEngine(savedEngine);
  } catch (e) {
    console.warn('エンジン初期化失敗、ローカルにフォールバック:', e);
  }

  // イベントリスナー
  document.getElementById('btn-login').addEventListener('click', signIn);
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut();
    showLogin();
  });

  // ナビゲーション
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // カメラ
  document.getElementById('btn-capture').addEventListener('click', handleCapture);
  document.getElementById('btn-retake').addEventListener('click', handleRetake);
  document.getElementById('file-input').addEventListener('change', handleFileSelect);
  document.getElementById('btn-detect').addEventListener('click', handleDetect);
  document.getElementById('btn-add-detected').addEventListener('click', handleAddDetected);

  // モーダル
  document.getElementById('fab-add').addEventListener('click', openAddModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeAddModal);
  document.getElementById('btn-modal-save').addEventListener('click', saveNewItem);
  document.getElementById('modal-add-item').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAddModal();
  });

  // アイテムアクションモーダル
  document.getElementById('btn-action-status').addEventListener('click', handleActionStatus);
  document.getElementById('btn-action-edit').addEventListener('click', handleActionEdit);
  document.getElementById('btn-action-shopping').addEventListener('click', handleActionShopping);
  document.getElementById('btn-action-delete').addEventListener('click', handleActionDelete);
  document.getElementById('btn-action-cancel').addEventListener('click', closeItemActions);
  document.getElementById('modal-item-actions').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeItemActions();
  });

  // 編集モーダル
  document.getElementById('btn-edit-save').addEventListener('click', handleEditSave);
  document.getElementById('btn-edit-cancel').addEventListener('click', () => {
    document.getElementById('modal-edit-item').classList.remove('active');
  });
  document.getElementById('modal-edit-item').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('modal-edit-item').classList.remove('active');
  });

  // 設定
  initSettings();

  // データ削除
  document.getElementById('btn-clear-data').addEventListener('click', async () => {
    if (!confirm('すべてのデータを削除しますか？この操作は取り消せません。')) return;
    await inventoryService.clearAll(state.user.uid);
    await shoppingService.clearAll(state.user.uid);
    showToast('データを削除しました');
  });

  // 初期ページ
  switchPage('camera');
}

// Service Worker登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(err => {
    console.warn('SW登録失敗:', err);
  });
}

init();
