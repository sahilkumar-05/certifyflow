export interface StorageProvider {
  save(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  // Deletes everything stored under a key prefix (a "folder").
  deletePrefix(prefix: string): Promise<void>;
}