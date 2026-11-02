// Client for the ftc-embeds API, shared by all widgets. See docs/api.md for the contract.
//
// Each REST endpoint is a preset of a GraphQL query (below) that the backend runs and caches
// for longer; the response is that query's result. Until the REST API is deployed, widgets can
// send the same query to a GraphQL endpoint instead (FTCScout's API allows cross-origin use).
//
// Nothing is set by default: configure({ apiBase }) (REST) or configure({ graphqlUrl }), or
// per widget with the apiBase / graphqlUrl options (api-base / graphql-url attributes).

const config = {
    apiBase: null, // REST base URL, e.g. "https://ftcscout-api.mmathijs.nl/rest/embeds/v1"
    graphqlUrl: null, // fallback: GraphQL endpoint, e.g. "https://ftcscout-api.mmathijs.nl/graphql"
    fetch: null, // custom fetch (SSR, tests, auth headers); null = globalThis.fetch
};

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/pit-map. */
export const PIT_MAP_QUERY = `query EmbedPitMap($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        season
        code
        pitMap {
            minX minY width height showPitNumbers showPitAddresses updatedAt
            elements {
                type x y width height label labelOrientation index address addressGroup color
                team { number name displayNumber }
            }
        }
    }
}`;

/** Set options for every widget on the page: configure({ apiBase }) or configure({ graphqlUrl }). */
export function configure(options = {}) {
    Object.assign(config, options);
    return { ...config };
}

/** Error from the embeds API. `status` is the HTTP status (0 = network/config problem). */
export class EmbedsApiError extends Error {
    constructor(message, status = 0, url = null) {
        super(message);
        this.name = "EmbedsApiError";
        this.status = status;
        this.url = url;
    }
    get notFound() {
        return this.status === 404;
    }
}

/** "2025/FPEEUR", "2025-FPEEUR" or { season, code } -> { season, code }. */
export function parseEventRef(ref) {
    if (ref && typeof ref === "object" && ref.season != null && ref.code) {
        return { season: +ref.season, code: String(ref.code).toUpperCase() };
    }
    let m = /^\s*(\d{4})\s*[/\-: ]\s*([A-Za-z0-9]+)\s*$/.exec(String(ref ?? ""));
    if (!m) throw new EmbedsApiError(`not an event reference: ${JSON.stringify(ref)} (use "2025/FPEEUR")`);
    return { season: +m[1], code: m[2].toUpperCase() };
}

const inflight = new Map(); // url -> Promise, so widgets showing the same event share one request

function fetcher(options) {
    let f = options.fetch || config.fetch || globalThis.fetch;
    if (!f) throw new EmbedsApiError("fetch is not available in this environment");
    return f;
}

/** Fetch JSON, sharing identical in-flight requests between widgets. */
function request(key, url, init, options) {
    let pending = inflight.get(key);
    if (!pending) {
        let doFetch = fetcher(options);
        pending = (async () => {
            let res;
            try {
                res = await doFetch(url, init);
            } catch (e) {
                throw new EmbedsApiError(`network error: ${e && e.message ? e.message : e}`, 0, url);
            }
            let body = null;
            try {
                body = await res.json();
            } catch {
                // handled below
            }
            if (!res.ok) {
                let msg = (body && (body.message || body.error || body.errors?.[0]?.message)) || `HTTP ${res.status}`;
                throw new EmbedsApiError(msg, res.status, url);
            }
            if (body == null) throw new EmbedsApiError("response is not JSON", res.status, url);
            if (Array.isArray(body.errors) && body.errors.length && !body.data) {
                throw new EmbedsApiError(body.errors[0].message || "GraphQL error", res.status, url);
            }
            return body;
        })().finally(() => inflight.delete(key));
        inflight.set(key, pending);
    }
    let signal = options.signal;
    if (!signal) return pending;
    // Let one caller give up without cancelling the shared request.
    return Promise.race([
        pending,
        new Promise((_, reject) => {
            if (signal.aborted) reject(signal.reason);
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    ]);
}

/**
 * Run a preset query: GET {apiBase}{path} when a REST base is configured, otherwise POST the
 * query to the GraphQL endpoint. Both return the query result ({ data: … }).
 */
async function preset(path, query, variables, options = {}) {
    let apiBase = options.apiBase || config.apiBase;
    let graphqlUrl = options.graphqlUrl || config.graphqlUrl;
    if (apiBase) {
        let url = `${String(apiBase).replace(/\/+$/, "")}${path}`;
        return request(`GET ${url}`, url, { headers: { Accept: "application/json" } }, options);
    }
    if (graphqlUrl) {
        let body = JSON.stringify({ query, variables });
        return request(`POST ${graphqlUrl} ${body}`, graphqlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body,
        }, options);
    }
    throw new EmbedsApiError(
        "no ftc-embeds API configured: call configure({ apiBase }) or configure({ graphqlUrl }), or set the option/attribute on the widget"
    );
}

/**
 * Pit map of an event: GET {apiBase}/events/{season}/{code}/pit-map (preset of PIT_MAP_QUERY).
 * Resolves to { season, code, updatedAt, pitMap } (pitMap is ApiV3PitMap JSON).
 * Rejects with EmbedsApiError; err.notFound means the event or its pit map doesn't exist.
 */
export async function getPitMap(event, options = {}) {
    let { season, code } = parseEventRef(event);
    let body = await preset(`/events/${season}/${encodeURIComponent(code)}/pit-map`, PIT_MAP_QUERY, { season, code }, options);
    let ev = body?.data?.eventByCode;
    if (body?.data && !ev) throw new EmbedsApiError(`no ${season} event ${code}`, 404);
    let pitMap = ev ? ev.pitMap : null;
    if (!pitMap) throw new EmbedsApiError(`event ${season} ${code} has no pit map`, 404);
    if (!Array.isArray(pitMap.elements)) throw new EmbedsApiError("pit map has no elements", 200);
    return { season, code, updatedAt: pitMap.updatedAt ?? null, pitMap };
}
