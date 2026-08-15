// 在庫アイテム CRUD サービス
import { getDb } from './firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, Timestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export class InventoryService {
  constructor() {
    this.unsubscribeListener = null;
  }

  /** リアルタイム購読開始 */
  subscribe(uid, callback) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'inventory');
    const q = query(colRef, orderBy('name'));

    this.unsubscribeListener = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // localStorageにキャッシュ
      localStorage.setItem('zaiko-inventory', JSON.stringify(items));
      callback(items);
    }, (err) => {
      console.warn('在庫リスナーエラー:', err);
      // オフラインフォールバック
      const cached = localStorage.getItem('zaiko-inventory');
      if (cached) callback(JSON.parse(cached));
    });
  }

  /** 購読解除 */
  unsubscribe() {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
  }

  /** アイテム追加 */
  async addItem(uid, { name, category, status }) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'inventory');
    await addDoc(colRef, {
      name,
      category: category || 'その他',
      status: status || 'あり',
      lastCheckedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  /** アイテム更新 */
  async updateItem(uid, itemId, data) {
    const db = getDb();
    const docRef = doc(db, 'users', uid, 'inventory', itemId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
      lastCheckedAt: data.lastCheckedAt ? Timestamp.fromDate(new Date(data.lastCheckedAt)) : Timestamp.now()
    });
  }

  /** アイテム削除 */
  async deleteItem(uid, itemId) {
    const db = getDb();
    const docRef = doc(db, 'users', uid, 'inventory', itemId);
    await deleteDoc(docRef);
  }

  /** 全データ削除 */
  async clearAll(uid) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'inventory');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    localStorage.removeItem('zaiko-inventory');
  }
}
