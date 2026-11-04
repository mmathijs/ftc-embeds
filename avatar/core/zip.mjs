// A store-only zip writer (section 13.5): local headers, central directory and end record, UTF-8
// names, no ZIP64. The date comes from the caller, so the core never reads the clock.

import { crc32 } from "./png.mjs";

// DOS date and time as zip stores them, from the date's local fields (2-second resolution, 1980+).
function dosDateTime(date) {
    let year = Math.min(2107, Math.max(1980, date.getFullYear()));
    let time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    let day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return [time, day];
}

/** Zip { name, data: Uint8Array, date: Date } files without compression. */
export function makeZip(files) {
    let enc = new TextEncoder();
    let entries = files.map((f) => ({ name: enc.encode(f.name), data: f.data, crc: crc32(f.data), when: dosDateTime(f.date) }));
    let size = 22;
    for (let e of entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
    let out = new Uint8Array(size);
    let v = new DataView(out.buffer);
    let o = 0;
    let offsets = [];
    // Version 2.0, flag bit 11 (UTF-8 names), method 0 (stored).
    let common = (at, e) => {
        v.setUint16(at, 20, true);
        v.setUint16(at + 2, 0x0800, true);
        v.setUint16(at + 4, 0, true);
        v.setUint16(at + 6, e.when[0], true);
        v.setUint16(at + 8, e.when[1], true);
        v.setUint32(at + 10, e.crc, true);
        v.setUint32(at + 14, e.data.length, true);
        v.setUint32(at + 18, e.data.length, true);
        v.setUint16(at + 22, e.name.length, true);
        v.setUint16(at + 24, 0, true);
    };
    for (let e of entries) {
        offsets.push(o);
        v.setUint32(o, 0x04034b50, true);
        common(o + 4, e);
        out.set(e.name, o + 30);
        out.set(e.data, o + 30 + e.name.length);
        o += 30 + e.name.length + e.data.length;
    }
    let dirStart = o;
    entries.forEach((e, i) => {
        v.setUint32(o, 0x02014b50, true);
        v.setUint16(o + 4, 20, true);
        common(o + 6, e);
        // comment length, disk, internal and external attributes: all 0
        v.setUint32(o + 42, offsets[i], true);
        out.set(e.name, o + 46);
        o += 46 + e.name.length;
    });
    v.setUint32(o, 0x06054b50, true);
    v.setUint16(o + 8, entries.length, true);
    v.setUint16(o + 10, entries.length, true);
    v.setUint32(o + 12, o - dirStart, true);
    v.setUint32(o + 16, dirStart, true);
    return out;
}
