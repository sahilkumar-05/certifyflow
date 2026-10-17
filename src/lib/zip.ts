// Minimal streaming ZIP writer (store only, no compression). PDFs are already
// compressed, so storing them keeps the CPU cost low. Files are read one at a
// time, so memory use stays small.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date) {
  const year = Math.max(d.getUTCFullYear(), 1980);
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

export type ZipSource = {
  name: string;
  // Returns the file content, or null to skip this file.
  load: () => Promise<Uint8Array | null>;
};

const MAX_ENTRIES = 65535;
const MAX_BYTES = 0xfffffff0; // classic ZIP limit, about 4 GB

export async function* zipChunks(
  sources: ZipSource[]
): AsyncGenerator<Uint8Array, void, undefined> {
  const central: Buffer[] = [];
  const { time, date } = dosDateTime(new Date());
  let offset = 0;
  let count = 0;

  for (const source of sources) {
    const data = await source.load();
    if (!data) continue;

    if (count >= MAX_ENTRIES) throw new Error("Too many files for a ZIP archive.");

    const name = Buffer.from(source.name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); // signature
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30); // extra length
    entry.writeUInt16LE(0, 32); // comment length
    entry.writeUInt16LE(0, 34); // disk number
    entry.writeUInt16LE(0, 36); // internal attributes
    entry.writeUInt32LE(0, 38); // external attributes
    entry.writeUInt32LE(offset, 42); // offset of the local header
    central.push(Buffer.concat([entry, name]));

    const size = local.length + name.length + data.length;
    if (offset + size > MAX_BYTES) throw new Error("The ZIP archive is too large.");

    yield local;
    yield name;
    yield data;

    offset += size;
    count++;
  }

  let centralSize = 0;
  for (const record of central) {
    yield record;
    centralSize += record.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the central directory
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length
  yield end;
}

// Wraps the generator as a web stream, so it can be returned from a route handler.
export function zipStream(sources: ZipSource[]): ReadableStream<Uint8Array> {
  const iterator = zipChunks(sources);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return(undefined);
    },
  });
}