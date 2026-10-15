import { LocalStorageProvider } from "./local";
import type { StorageProvider } from "./types";

// Local files are fine for development. Serverless hosts (e.g. Vercel) do not
// keep local files, so swap this for an object storage provider in production.
export const storage: StorageProvider = new LocalStorageProvider();