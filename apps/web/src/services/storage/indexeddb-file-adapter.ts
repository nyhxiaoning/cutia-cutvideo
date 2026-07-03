import type { StorageAdapter } from "./types";

/**
 * IndexedDB-backed adapter for storing File/Blob data.
 * Used as a fallback when OPFS is unavailable (e.g. non-HTTPS context).
 *
 * Stores files as { id, blob, name, type, size } records.
 */
export class IndexedDBFileAdapter implements StorageAdapter<File> {
	private dbName: string;
	private storeName: string;

	constructor(directoryName: string) {
		this.dbName = `file-${directoryName}`;
		this.storeName = "files";
	}

	private async getDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName, { keyPath: "id" });
				}
			};
		});
	}

	async get(key: string): Promise<File | null> {
		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);

			const result = await new Promise<{
				id: string;
				blob: Blob;
				name: string;
				type: string;
				size: number;
			} | null>((resolve, reject) => {
				const request = store.get(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result || null);
			});

			if (!result) return null;
			return new File([result.blob], result.name, {
				type: result.type,
			});
		} catch {
			return null;
		}
	}

	async set(key: string, file: File): Promise<void> {
		const db = await this.getDB();
		const transaction = db.transaction([this.storeName], "readwrite");
		const store = transaction.objectStore(this.storeName);

		return new Promise((resolve, reject) => {
			const request = store.put({
				id: key,
				blob: file,
				name: file.name,
				type: file.type,
				size: file.size,
			});
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async remove(key: string): Promise<void> {
		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);

			await new Promise<void>((resolve, reject) => {
				const request = store.delete(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch {
			// Ignore not-found errors
		}
	}

	async list(): Promise<string[]> {
		const db = await this.getDB();
		const transaction = db.transaction([this.storeName], "readonly");
		const store = transaction.objectStore(this.storeName);

		return new Promise((resolve, reject) => {
			const request = store.getAllKeys();
			request.onerror = () => reject(request.error);
			request.onsuccess = () =>
				resolve((request.result as string[]) || []);
		});
	}

	async clear(): Promise<void> {
		const db = await this.getDB();
		const transaction = db.transaction([this.storeName], "readwrite");
		const store = transaction.objectStore(this.storeName);

		return new Promise((resolve, reject) => {
			const request = store.clear();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}
}
