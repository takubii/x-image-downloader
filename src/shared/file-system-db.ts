import { DEFAULT_MEDIA_TYPE } from "./media-type";
import type { MediaType } from "./media-type";

const DB_NAME = "x-image-downloader";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const SAVED_FILE_STORE = "savedFiles";
const LEGACY_DIRECTORY_KEY = "save-directory";
const DIRECTORY_KEY_PREFIX = "save-directory";

export type SavedFileRecord = {
  filename: string;
  imageKey: string;
  mediaType?: MediaType;
};

export function getDirectoryStorageKey(mediaType: MediaType = DEFAULT_MEDIA_TYPE): string {
  return `${DIRECTORY_KEY_PREFIX}:${mediaType}`;
}

export function getSavedFileRecordStorageKey(
  filename: string,
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): string {
  return `${mediaType}:${filename}`;
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<void> {
  const db = await openDatabase();
  await putValue(db, HANDLE_STORE, handle, getDirectoryStorageKey(mediaType));
  db.close();
}

export async function getDirectoryHandle(
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase();
  const handle = await getValue<FileSystemDirectoryHandle>(
    db,
    HANDLE_STORE,
    getDirectoryStorageKey(mediaType),
  );

  if (handle || mediaType !== DEFAULT_MEDIA_TYPE) {
    db.close();
    return handle ?? null;
  }

  const legacyHandle = await getValue<FileSystemDirectoryHandle>(
    db,
    HANDLE_STORE,
    LEGACY_DIRECTORY_KEY,
  );
  db.close();
  return legacyHandle ?? null;
}

export async function clearDirectoryHandle(
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<void> {
  const db = await openDatabase();
  await deleteValue(db, HANDLE_STORE, getDirectoryStorageKey(mediaType));

  if (mediaType === DEFAULT_MEDIA_TYPE) {
    await deleteValue(db, HANDLE_STORE, LEGACY_DIRECTORY_KEY);
  }

  db.close();
}

export async function getSavedFileRecord(
  filename: string,
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<SavedFileRecord | null> {
  const db = await openDatabase();
  const record = await getValue<SavedFileRecord>(
    db,
    SAVED_FILE_STORE,
    getSavedFileRecordStorageKey(filename, mediaType),
  );

  if (record || mediaType !== DEFAULT_MEDIA_TYPE) {
    db.close();
    return record ?? null;
  }

  const legacyRecord = await getValue<SavedFileRecord>(db, SAVED_FILE_STORE, filename);
  db.close();
  return legacyRecord ?? null;
}

export async function saveSavedFileRecord(
  record: SavedFileRecord,
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<void> {
  const db = await openDatabase();
  await putValue(
    db,
    SAVED_FILE_STORE,
    { ...record, mediaType },
    getSavedFileRecordStorageKey(record.filename, mediaType),
  );
  db.close();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }

      if (!db.objectStoreNames.contains(SAVED_FILE_STORE)) {
        db.createObjectStore(SAVED_FILE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getValue<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function putValue<T>(
  db: IDBDatabase,
  storeName: string,
  value: T,
  key: IDBValidKey,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteValue(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
