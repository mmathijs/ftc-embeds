// PNG for the avatar maker (section 13.4): an encoder for 8-bit RGB or RGBA with per-row filter
// choice and no ancillary chunks, a zlib "stored" fallback for browsers without CompressionStream,
// and a small decoder for the same kind of files (tests and download checks). Compression is
// injected, so this runs in Node and in browsers.

let crcTable = null;

/** CRC-32 (polynomial 0xEDB88320), as PNG and zip use it. */
export function crc32(bytes, crc = 0) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    crc = ~crc >>> 0;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return ~crc >>> 0;
}

function adler32(bytes) {
    let a = 1;
    let b = 0;
    for (let i = 0; i < bytes.length; i++) {
        a = (a + bytes[i]) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}

/**
 * A zlib stream with stored (uncompressed) deflate blocks: valid everywhere, and small enough here
 * (a 40 × 40 RGBA image is 6,440 bytes raw). For browsers without CompressionStream.
 */
export async function deflateStored(data) {
    let blocks = Math.max(1, Math.ceil(data.length / 65535));
    let out = new Uint8Array(2 + data.length + blocks * 5 + 4);
    out[0] = 0x78;
    out[1] = 0x01;
    let o = 2;
    for (let b = 0; b < blocks; b++) {
        let chunk = data.subarray(b * 65535, Math.min(data.length, (b + 1) * 65535));
        out[o++] = b === blocks - 1 ? 1 : 0;
        out[o++] = chunk.length & 255;
        out[o++] = chunk.length >>> 8;
        out[o++] = ~chunk.length & 255;
        out[o++] = (~chunk.length >>> 8) & 255;
        out.set(chunk, o);
        o += chunk.length;
    }
    let adler = adler32(data);
    out[o++] = adler >>> 24;
    out[o++] = (adler >>> 16) & 255;
    out[o++] = (adler >>> 8) & 255;
    out[o++] = adler & 255;
    return out;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function chunk(type, data) {
    let out = new Uint8Array(12 + data.length);
    let view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
}

const paeth = (a, b, c) => {
    let p = a + b - c;
    let pa = Math.abs(p - a);
    let pb = Math.abs(p - b);
    let pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// Filter one row with type t (0 to 4) into out; bpp bytes per pixel.
function filterRow(t, row, prev, bpp, out) {
    for (let i = 0; i < row.length; i++) {
        let a = i >= bpp ? row[i - bpp] : 0;
        let b = prev ? prev[i] : 0;
        let c = prev && i >= bpp ? prev[i - bpp] : 0;
        let p = t === 0 ? 0 : t === 1 ? a : t === 2 ? b : t === 3 ? (a + b) >> 1 : paeth(a, b, c);
        out[i] = (row[i] - p) & 255;
    }
}

/**
 * Encode a { width, height, data } 8-bit RGBA image as PNG: colour type 6 with alpha, 2 without.
 * Each row gets the filter with the smallest sum of absolute filtered bytes (as signed bytes; ties
 * to the lowest type). Asserts the export rules first: opaque means alpha 255 everywhere, and a
 * transparent pixel has RGB 0 (check: false skips that, for storing a source exactly as it is).
 * deflate(bytes) must return a zlib stream.
 */
export async function encodePNG(image, { alpha, check = true }, deflate) {
    let { width, height, data } = image;
    for (let i = 0; check && i < data.length; i += 4) {
        if (!alpha && data[i + 3] !== 255) throw new Error("encodePNG: an opaque image has a pixel with alpha below 255");
        if (alpha && data[i + 3] === 0 && (data[i] || data[i + 1] || data[i + 2])) throw new Error("encodePNG: a fully transparent pixel has colour");
    }
    let bpp = alpha ? 4 : 3;
    let stride = width * bpp;
    let raw = new Uint8Array((stride + 1) * height);
    let row = new Uint8Array(stride);
    let prev = null;
    let trial = new Uint8Array(stride);
    let best = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < bpp; c++) row[x * bpp + c] = data[(y * width + x) * 4 + c];
        }
        let bestType = 0;
        let bestSum = Infinity;
        for (let t = 0; t <= 4; t++) {
            filterRow(t, row, prev, bpp, trial);
            let sum = 0;
            for (let i = 0; i < stride; i++) sum += trial[i] < 128 ? trial[i] : 256 - trial[i];
            if (sum < bestSum) {
                bestSum = sum;
                bestType = t;
                best.set(trial);
            }
        }
        raw[y * (stride + 1)] = bestType;
        raw.set(best, y * (stride + 1) + 1);
        prev = Uint8Array.from(row);
    }
    let ihdr = new Uint8Array(13);
    let v = new DataView(ihdr.buffer);
    v.setUint32(0, width);
    v.setUint32(4, height);
    ihdr[8] = 8;
    ihdr[9] = alpha ? 6 : 2;
    let idat = await deflate(raw);
    let parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
    let out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (let p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}

/**
 * Decode an 8-bit, non-interlaced RGB or RGBA PNG (what encodePNG writes) to { width, height, data }
 * RGBA. inflate(zlibBytes) returns the raw bytes. Checks the signature and every chunk's CRC.
 */
export async function decodePNG(bytes, inflate) {
    if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error("decodePNG: not a PNG");
    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let o = 8;
    let width = 0, height = 0, type = 0;
    let idat = [];
    while (o < bytes.length) {
        let len = view.getUint32(o);
        let name = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
        let body = bytes.subarray(o + 8, o + 8 + len);
        if (crc32(bytes.subarray(o + 4, o + 8 + len)) !== view.getUint32(o + 8 + len)) throw new Error(`decodePNG: bad CRC in ${name}`);
        if (name === "IHDR") {
            width = view.getUint32(o + 8);
            height = view.getUint32(o + 12);
            type = body[9];
            if (body[8] !== 8 || (type !== 2 && type !== 6) || body[12] !== 0) throw new Error("decodePNG: only 8-bit RGB or RGBA without interlacing");
        } else if (name === "IDAT") idat.push(body);
        else if (name === "IEND") break;
        o += 12 + len;
    }
    let joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
    let p = 0;
    for (let c of idat) joined.set(c, (p += c.length) - c.length);
    let raw = await inflate(joined);
    let bpp = type === 6 ? 4 : 3;
    let stride = width * bpp;
    let data = new Uint8ClampedArray(width * height * 4);
    let prev = new Uint8Array(stride);
    let row = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
        let t = raw[y * (stride + 1)];
        let line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let i = 0; i < stride; i++) {
            let a = i >= bpp ? row[i - bpp] : 0;
            let b = y ? prev[i] : 0;
            let c = y && i >= bpp ? prev[i - bpp] : 0;
            let pr = t === 0 ? 0 : t === 1 ? a : t === 2 ? b : t === 3 ? (a + b) >> 1 : paeth(a, b, c);
            row[i] = (line[i] + pr) & 255;
        }
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = row[x * bpp + c];
            data[(y * width + x) * 4 + 3] = bpp === 4 ? row[x * 4 + 3] : 255;
        }
        prev.set(row);
    }
    return { width, height, data };
}
