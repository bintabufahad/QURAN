import { CustomAudioSource } from '../types/quran';

const DB_NAME = 'bayan_mushaf_audio_db';
const STORE_NAME = 'custom_audio_blobs';
const META_KEY = 'bayan_custom_audio_sources_v1';

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioBlobUrl(id: string): Promise<string | null> {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      if (!blob) {
        resolve(null);
      } else {
        resolve(URL.createObjectURL(blob));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function loadCustomAudioMeta(): CustomAudioSource[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomAudioMeta(items: CustomAudioSource[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(items));
}
