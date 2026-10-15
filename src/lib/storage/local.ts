import fs from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./types";

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

// Resolves a storage key to a file path and blocks path traversal.
function resolveSafe(key: string): string {
  const full = path.resolve(ROOT, key);
  if (full === ROOT || !full.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export class LocalStorageProvider implements StorageProvider {
  async save(key: string, data: Uint8Array): Promise<void> {
    const full = resolveSafe(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(resolveSafe(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(resolveSafe(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolveSafe(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await fs.rm(resolveSafe(prefix), { recursive: true, force: true });
  }
}