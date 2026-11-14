// The alliances and the bracket of an event's playoffs, worked out from its matches (the API has no
// alliance list): who played together as Captain/FirstPick/SecondPick, numbered by their captains'
// qualification rank (alliance selection goes in rank order), and the bracket from the results.
// Pure functions, for the event-playoffs widget and its tests.

const PLAYOFF_LEVELS = new Set(["DoubleElim", "Semis", "Finals"]);
const ROLE_ORDER = { Captain: 0, FirstPick: 1, SecondPick: 2 };

/** The winning color of a played match ("Red" / "Blue"), "Tie", or null when it has no result yet. */
export function matchWinner(m) {
    if (!m.hasBeenPlayed || !m.scores) return null;
    let r = m.scores.red?.totalPoints;
    let b = m.scores.blue?.totalPoints;
    if (r == null || b == null) return null;
    return r > b ? "Red" : b > r ? "Blue" : "Tie";
}

/** The playoff matches in playing order. */
export function playoffMatches(ev) {
    let order = { Semis: 0, DoubleElim: 0, Finals: 1 };
    return (ev.matches || [])
        .filter((m) => PLAYOFF_LEVELS.has(m.tournamentLevel))
        .sort((a, b) => order[a.tournamentLevel] - order[b.tournamentLevel] || a.series - b.series || a.matchNum - b.matchNum || a.id - b.id);
}

/**
 * The alliances: [{ id, seed, key, captain, teams: [captain, first pick, second pick] }], seed 1
 * first. `seed` is null when some captain has no rank at this event (a championship's playoffs,
 * whose teams ranked in their divisions): a guessed number would be wrong, so they're named by
 * their captain then, in the order they first played. `id` numbers them either way. A match side's
 * key is its captain (or, without roles, its lowest team number).
 */
export function playoffAlliances(ev) {
    let ranks = new Map((ev.teams || []).map((t) => [t.teamNumber, t.stats?.rank ?? null]));
    let byKey = new Map();
    let seen = 0;
    for (let m of playoffMatches(ev)) {
        for (let color of ["Red", "Blue"]) {
            let side = m.teams.filter((t) => t.alliance === color);
            if (!side.length) continue;
            let key = sideKey(side);
            if (!byKey.has(key)) byKey.set(key, { key, captain: key, members: new Map(), first: seen++ });
            let a = byKey.get(key);
            for (let t of side) if (!a.members.has(t.teamNumber) || t.allianceRole in ROLE_ORDER) a.members.set(t.teamNumber, t.allianceRole);
        }
    }
    let rank = (a) => ranks.get(a.captain) ?? Infinity;
    let list = [...byKey.values()];
    let ranked = list.every((a) => ranks.get(a.captain) != null);
    return list
        .sort((x, y) => (ranked ? rank(x) - rank(y) : 0) || x.first - y.first)
        .map((a, i) => ({
            id: i + 1,
            seed: ranked ? i + 1 : null,
            key: a.key,
            captain: a.captain,
            teams: [...a.members].sort((x, y) => (ROLE_ORDER[x[1]] ?? 3) - (ROLE_ORDER[y[1]] ?? 3) || x[0] - y[0]).map(([n]) => n),
        }));
}

function sideKey(side) {
    let captain = side.find((t) => t.allianceRole === "Captain");
    return captain ? captain.teamNumber : Math.min(...side.map((t) => t.teamNumber));
}

/**
 * The bracket: { format: "double" | "series", upper: [round, …], lower: [round, …], finals: [series],
 * champion, finalist } where a round is a list of entries and an entry is
 * { matches, red, blue, winner } (red/blue: alliance ids; winner: the id, once decided).
 *
 * Double elimination (2023 on): an alliance plays in the upper bracket until it loses once, in the
 * lower until it loses twice; the matches between the last upper and the last lower alliance are
 * the finals. A match's round is one after the latest round either alliance played in its bracket.
 * Older seasons: best-of-3 semifinals and finals, each a series.
 */
export function playoffBracket(ev) {
    let alliances = playoffAlliances(ev);
    let idOf = new Map(alliances.map((a) => [a.key, a.id]));
    let sides = (m) => ["Red", "Blue"].map((c) => {
        let side = m.teams.filter((t) => t.alliance === c);
        return side.length ? idOf.get(sideKey(side)) : null;
    });
    let matches = playoffMatches(ev);
    let entry = (m) => {
        let [red, blue] = sides(m);
        let w = matchWinner(m);
        return { matches: [m], red, blue, winner: w === "Red" ? red : w === "Blue" ? blue : null };
    };

    if (!matches.some((m) => m.tournamentLevel === "DoubleElim")) {
        // Best-of-3 series (and events with finals only): group by level and series.
        let series = new Map();
        for (let m of matches) {
            let key = `${m.tournamentLevel}|${m.series}`;
            if (!series.has(key)) series.set(key, { level: m.tournamentLevel, matches: [] });
            series.get(key).matches.push(m);
        }
        let toEntry = (s) => seriesEntry(s.matches, sides);
        let semis = [...series.values()].filter((s) => s.level === "Semis").map(toEntry);
        let finals = [...series.values()].filter((s) => s.level === "Finals").map(toEntry);
        let last = finals[finals.length - 1];
        return { format: "series", alliances, upper: semis.length ? [semis] : [], lower: [], finals, ...result(last) };
    }

    let losses = new Map();
    let lastRound = { upper: new Map(), lower: new Map() };
    let upper = [];
    let lower = [];
    let finalsMatches = [];
    let finalists = null;
    for (let m of matches) {
        let [red, blue] = sides(m);
        let lr = losses.get(red) || 0;
        let lb = losses.get(blue) || 0;
        let pair = [red, blue].sort().join("|");
        // The finals: the upper bracket's last alliance against the lower's, until one has two losses.
        let bracket = m.tournamentLevel === "Finals" || finalists === pair || (lr !== lb && finalists == null && red != null && blue != null) ? "finals" : lr === 0 ? "upper" : "lower";
        if (bracket === "finals") {
            finalists = pair;
            finalsMatches.push(m);
        } else {
            let rounds = bracket === "upper" ? upper : lower;
            let last = lastRound[bracket];
            let round = Math.max(last.get(red) ?? -1, last.get(blue) ?? -1) + 1;
            (rounds[round] ||= []).push(entry(m));
            if (red != null) last.set(red, round);
            if (blue != null) last.set(blue, round);
        }
        let w = matchWinner(m);
        if (w === "Red" && blue != null) losses.set(blue, lb + 1);
        if (w === "Blue" && red != null) losses.set(red, lr + 1);
    }
    let finals = finalsMatches.length ? [seriesEntry(finalsMatches, sides, (seed) => (losses.get(seed) || 0) >= 2)] : [];
    return { format: "double", alliances, upper: upper.filter(Boolean), lower: lower.filter(Boolean), finals, ...result(finals[0]) };
}

/**
 * A series of matches between the same two alliances. Decided when one side has two wins, or (for
 * the double-elimination finals) when `out(seed)` says a side is eliminated.
 */
function seriesEntry(matches, sides, out = null) {
    let [red, blue] = sides(matches[0]);
    let wins = new Map([[red, 0], [blue, 0]]);
    for (let m of matches) {
        let [r, b] = sides(m);
        let w = matchWinner(m);
        if (w === "Red") wins.set(r, (wins.get(r) || 0) + 1);
        if (w === "Blue") wins.set(b, (wins.get(b) || 0) + 1);
    }
    let winner = null;
    if (out) {
        if (out(red) && !out(blue)) winner = blue;
        else if (out(blue) && !out(red)) winner = red;
    } else if (wins.get(red) >= 2 || wins.get(blue) >= 2) winner = wins.get(red) > wins.get(blue) ? red : blue;
    return { matches, red, blue, winner, wins: [wins.get(red) || 0, wins.get(blue) || 0] };
}

function result(final) {
    if (!final || final.winner == null) return { champion: null, finalist: null };
    return { champion: final.winner, finalist: final.winner === final.red ? final.blue : final.red };
}
