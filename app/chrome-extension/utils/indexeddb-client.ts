type UpgradeCallback = (db: IDBDatabase, oldVersion: number, newVersion: number | null) => void;

export class IndexedDbClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly name: string,
    private readonly version: number,
    private readonly onUpgrade?: UpgradeCallback,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onupgradeneeded = (event) => {
        this.onUpgrade?.(request.result, event.oldVersion, request.transaction?.db.version ?? null);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Failed to open ${this.name}`));
    });

    return this.dbPromise;
  }

  private async store(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const store = await this.store(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error || new Error('IndexedDB get failed'));
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.store(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error || new Error('IndexedDB getAll failed'));
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const store = await this.store(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('IndexedDB put failed'));
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await this.store(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('IndexedDB delete failed'));
    });
  }
}
