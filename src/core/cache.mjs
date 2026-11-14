// The widgets' memory in the visitor's browser (localStorage): the last answer each widget loaded,
// so it can show that when the network fails (event venues), and the language packs. Everything
// here fails quietly: without storage (private mode, blocked, no DOM) the widgets just load.

const STORE_PREFIX = "ftcw:";
/** Bump when the cached shapes change in a way older views can't read. */
const CACHE_VERSION = 1;
/** Answers older than this aren't shown (ms): 30 days. */
export const CACHE_MAX_AGE = 30 * 86400e3;
/** Larger answers aren't kept (characters of JSON). */
const MAX_ENTRY = 400_000;

/** localStorage, or null when it isn't there or is blocked. */
export function storage() {
    try {
        let s = globalThis.localStorage;
        return s && typeof s.getItem === "function" ? s : null;
    } catch {
        return null;
    }
}

/** The storage key for a widget's answer: ftcw:d:<part>|<part>|… */
export const cacheKey = (parts) => `${STORE_PREFIX}d:${parts.map((p) => (p == null ? "" : String(p))).join("|")}`;

/** { data, at } stored under key, or null (missing, too old, unreadable, another version). */
export function readCache(key, { maxAge = CACHE_MAX_AGE, now = Date.now(), store = storage() } = {}) {
    if (!store || !key) return null;
    try {
        let entry = JSON.parse(store.getItem(key));
        if (!entry || entry.v !== CACHE_VERSION || typeof entry.at !== "number" || entry.data == null) return null;
        if (now - entry.at > maxAge) {
            store.removeItem(key);
            return null;
        }
        return { data: entry.data, at: entry.at };
    } catch {
        return null;
    }
}

/** Keep data under key. When storage is full, drops the oldest widget answers and tries once more. */
export function writeCache(key, data, { now = Date.now(), store = storage() } = {}) {
    if (!store || !key || data == null) return false;
    let json;
    try {
        json = JSON.stringify({ v: CACHE_VERSION, at: now, data });
    } catch {
        return false;
    }
    if (json.length > MAX_ENTRY) return false;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            store.setItem(key, json);
            return true;
        } catch {
            if (attempt === 0 && !pruneCache(store, 0.5)) return false;
        }
    }
    return false;
}

export function dropCache(key, store = storage()) {
    try {
        store?.removeItem(key);
    } catch {
        // nothing to do
    }
}

/** Remove the oldest `share` of the widgets' answers. Returns how many were removed. */
export function pruneCache(store = storage(), share = 0.5) {
    if (!store) return 0;
    let entries = [];
    try {
        for (let i = 0; i < store.length; i++) {
            let k = store.key(i);
            if (!k?.startsWith(`${STORE_PREFIX}d:`)) continue;
            let at = 0;
            try {
                at = JSON.parse(store.getItem(k))?.at || 0;
            } catch {
                // unreadable: oldest
            }
            entries.push([k, at]);
        }
        entries.sort((a, b) => a[1] - b[1]);
        let gone = entries.slice(0, Math.max(1, Math.ceil(entries.length * share)));
        for (let [k] of gone) store.removeItem(k);
        return gone.length;
    } catch {
        return 0;
    }
}

/** Whether a failed request is worth trying again: network trouble, timeouts, rate limits, server errors. */
export const retryable = (error) => {
    let s = error?.status ?? 0;
    return s === 0 || s === 408 || s === 429 || s >= 500;
};

/** Wait before retry number `attempt` (0, 1, …): 5 s, 10 s, 20 s, … up to 5 min, ±20%. */
export function retryDelay(attempt, random = Math.random()) {
    let base = Math.min(300, 5 * 2 ** Math.max(0, attempt));
    return Math.round(base * 1000 * (0.8 + 0.4 * random));
}
