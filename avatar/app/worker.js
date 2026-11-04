/*!
 * ftc-embeds.com/avatar analysis worker. License: MIT
 */
// Runs the slow parts of the avatar maker off the main thread. Milestone 1 only answers a ping, so
// the page knows module workers start here; analyze() and candidates() move in with milestone 2.
import { AVATAR_SIZE } from "../core/avatar.mjs";

self.onmessage = (e) => {
    if (e.data && e.data.type === "ping") self.postMessage({ type: "pong", size: AVATAR_SIZE });
};
