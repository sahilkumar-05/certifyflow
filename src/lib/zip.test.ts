import { describe, expect, it } from "vitest";
import { crc32, zipChunks } from "./zip";

async function build(files: { name: string; data: string | null }[]) {
  const sources = files.map((f) => ({
    name: f.name,
    load: async () => (f.data === null ? null : Buffer.from(f.data)),
  }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of zipChunks(sources)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Reads the archive the way an unzip tool does: end record, central directory, local entries.
function readEntries(zip: Buffer) {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);

  const count = zip.readUInt16LE(end + 10);
  const centralSize = zip.readUInt32LE(end + 12);
  const centralOffset = zip.readUInt32LE(end + 16);
  expect(centralOffset + centralSize).toBe(end);

  const entries: { name: string; text: string }[] = [];
  let pos = centralOffset;

  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(pos)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(pos + 16);
    const size = zip.readUInt32LE(pos + 24);
    const nameLength = zip.readUInt16LE(pos + 28);
    const localOffset = zip.readUInt32LE(pos + 42);
    const name = zip.subarray(pos + 46, pos + 46 + nameLength).toString();

    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const start = localOffset + 30 + localNameLength;
    const data = zip.subarray(start, start + size);

    expect(crc32(data)).toBe(crc);
    entries.push({ name, text: data.toString() });
    pos += 46 + nameLength;
  }
  return entries;
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipChunks", () => {
  it("writes an archive that can be read back", async () => {
    const zip = await build([
      { name: "a.pdf", data: "hello" },
      { name: "b.pdf", data: "world!!" },
    ]);
    expect(readEntries(zip)).toEqual([
      { name: "a.pdf", text: "hello" },
      { name: "b.pdf", text: "world!!" },
    ]);
  });

  it("skips files that cannot be loaded", async () => {
    const zip = await build([
      { name: "missing.pdf", data: null },
      { name: "ok.pdf", data: "data" },
    ]);
    expect(readEntries(zip)).toEqual([{ name: "ok.pdf", text: "data" }]);
  });

  it("writes a valid empty archive", async () => {
    const zip = await build([]);
    expect(zip.length).toBe(22);
    expect(readEntries(zip)).toEqual([]);
  });
});