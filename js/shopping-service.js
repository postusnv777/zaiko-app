// 買い物リスト CRUD サービス
import { getDb } from './firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, Timestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export class ShoppingService {
  constructor(inventoryService) {
    this.inventoryService = inventoryService;
    this.unsubscribeListener = null;
  }

  /** リアルタイム購読開始 */
  subscribe(uid, callback) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'shoppingList');
    const q = query(colRef, orderBy('addedAt', 'desc'));

    this.unsubscribeListener = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('zaiko-shopping', JSON.stringify(items));
      callback(items);
    }, (err) => {
      console.warn('買い物リストリスナーエラー:', err);
      const cached = localStorage.getItem('zaiko-shopping');
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

  /** リストに追加 */
  async addToList(uid, { name, category, sourceItemId }) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'shoppingList');
    await addDoc(colRef, {
      name,
      category: category || 'その他',
      purchased: false,
      sourceItemId: sourceItemId || null,
      addedAt: Timestamp.now(),
      purchasedAt: null
    });
  }

  /** 購入済みにする（在庫も更新） */
  async markPurchased(uid, itemId, sourceItemId) {
    const db = getDb();
    const docRef = doc(db, 'users', uid, 'shoppingList', itemId);
    await updateDoc(docRef, {
      purchased: true,
      purchasedAt: Timestamp.now()
    });

    // 在庫アイテムの状態を「あり」に更新
    if (sourceItemId) {
      try {
        await this.inventoryService.updateItem(uid, sourceItemId, {
          status: 'あり',
          lastCheckedAt: new Date()
        });
      } catch (e) {
        console.warn('在庫状態の更新に失敗:', e);
      }
    }
  }

  /** リストから削除 */
  async removeFromList(uid, itemId) {
    const db = getDb();
    const docRef = doc(db, 'users', uid, 'shoppingList', itemId);
    await deleteDoc(docRef);
  }

  /** 全データ削除 */
  async clearAll(uid) {
    const db = getDb();
    const colRef = collection(db, 'users', uid, 'shoppingList');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    localStorage.removeItem('zaiko-shopping');
  }
}
