/* Tools for AI agents on ftc-embeds.com.
 *
 * A page registers what it can do as tools: a name, a description, a JSON Schema for the input and
 * a function. They're offered two ways:
 *   - WebMCP (navigator.modelContext), where the browser or an extension provides it: the agent
 *     sees the tools and calls them, without clicking through the page.
 *   - window.ftcEmbedsAgent, always: list() describes the tools, call(name, input) runs one, for
 *     agents that can run JavaScript in the page (and for testing).
 * A tool returns a plain object (shown to the agent as JSON); { images: [{ label, uri }] } in it are
 * PNG data URIs, sent as images as well so the agent can look at them.
 * Every page offers site_guide: the site's guide for agents, /llms.txt.
 */
(() => {
    "use strict";
    if (window.ftcEmbedsAgent) return;
    const tools = new Map();
    const handles = new Map();   // name -> what registerTool returned (older versions: { unregister })

    const text = (value) => JSON.stringify(value, (k, v) => (v instanceof Error ? v.message : v), 1);
    function toResult(out) {
        let images = out && Array.isArray(out.images) ? out.images : [];
        let rest = out && typeof out === "object" && !Array.isArray(out) ? Object.assign({}, out) : out;
        if (images.length) rest.images = images.map((im) => im.label);
        let content = [{ type: "text", text: typeof rest === "string" ? rest : text(rest) }];
        for (let im of images) {
            let m = /^data:([^;,]+);base64,(.*)$/.exec(im.uri || "");
            if (m) content.push({ type: "image", mimeType: m[1], data: m[2] });
        }
        return { content };
    }
    async function run(tool, input) {
        try { return toResult(await tool.run(input || {})); }
        catch (e) { return { content: [{ type: "text", text: `Error: ${(e && e.message) || e}` }], isError: true }; }
    }
    const forBrowser = (tool) => ({
        name: tool.name, description: tool.description, inputSchema: tool.inputSchema || { type: "object", properties: {} },
        annotations: tool.readOnly ? { readOnlyHint: true } : undefined,
        execute: (input) => run(tool, input),
    });
    function offer(tool) {
        let mc = navigator.modelContext;
        if (!mc) return;
        try {
            if (typeof mc.registerTool === "function") {
                let old = handles.get(tool.name);
                if (old && typeof old.unregister === "function") old.unregister();
                else if (typeof mc.unregisterTool === "function" && old !== undefined) mc.unregisterTool(tool.name);
                handles.set(tool.name, mc.registerTool(forBrowser(tool)) || null);
            } else if (typeof mc.provideContext === "function") {
                mc.provideContext({ tools: [...tools.values()].map(forBrowser) });   // replaces the whole set
            }
        } catch (e) {
            console.warn(`ftc-embeds: couldn't offer the tool ${tool.name} to the browser's agent`, e);
        }
    }

    window.ftcEmbedsAgent = {
        /** register({ name, description, inputSchema, readOnly, run: async (input) => result }) */
        register(tool) {
            tools.set(tool.name, tool);
            offer(tool);
        },
        /** Every tool on this page: name, description and input schema. */
        list() {
            return [...tools.values()].map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema || { type: "object", properties: {} } }));
        },
        /** Run a tool; resolves with what it returns (images as data URIs), rejects with its error. */
        async call(name, input) {
            let t = tools.get(name);
            if (!t) throw new Error(`No tool ${name} on this page. ftcEmbedsAgent.list() has the ones there are.`);
            return t.run(input || {});
        },
    };

    window.ftcEmbedsAgent.register({
        name: "site_guide",
        description: "The guide to ftc-embeds.com for AI agents (/llms.txt): what the site does (free FIRST Tech Challenge widgets, pit maps, a pit display, team badges, an avatar maker), its pages and their URL parameters, the docs and the APIs.",
        readOnly: true,
        inputSchema: { type: "object", properties: {} },
        async run() {
            let r = await fetch("/llms.txt");
            if (!r.ok) throw new Error(`The guide couldn't be loaded (${r.status}).`);
            return await r.text();
        },
    });
})();
