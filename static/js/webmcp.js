// WebMCP: hand an in-browser agent a typed tool list for this site.
//
// Spec: https://webmachinelearning.github.io/webmcp/ (W3C Community Group
// Draft). The entry point moved from `navigator.modelContext` to
// `document.modelContext`; Chromium 150 deprecated the old name, while
// readiness scanners and polyfills still shim the old one into browsers
// that have no native API. Both are honoured, `document` first.
//
// This bundle is NOT in core.bundle.js. webmcp-loader.js (which is) injects
// it only when a model context exists, so ordinary visitors never download
// it. Two tool families are registered:
//
//   1. In-page tools — things only the page can do: search the site's own
//      index in the reader's language, read the current page's structured
//      metadata and text, fetch its JSON API twin, list sections, switch
//      language, navigate, and produce citations.
//   2. The nine MCP server tools, proxied to https://mcp.wheelofheaven.world
//      over Streamable HTTP so the agent gets the corpus (passages, graph,
//      comparative datasets, bibliography) without knowing the endpoint.
//      Their names, descriptions and schemas are copied from the server's
//      tools/list — when the server's tool set changes, update SERVER_TOOLS
//      here (and the skills index; see the docs maintenance table). The
//      session is opened lazily on the first call, so registering costs no
//      network.
//
// Every tool is read-only except open_page and switch_language, which
// navigate. Nothing here needs credentials: the corpus is CC0.
//
// Cache: served under /js/* with a 7-day CDN cache and loaded with a manual
// `?v=N` tag from webmcp-loader.js — bump it there when this file changes.
(function () {
    "use strict";

    const API_BASE = "https://api.wheelofheaven.world/v1/";
    const MCP_URL = "https://mcp.wheelofheaven.world/mcp";
    const MCP_PROTOCOL = "2025-06-18";
    const LANGS = ["en", "de", "es", "fr", "ja", "ko", "ru", "zh", "zh-Hant", "he"];
    const LANG_PREFIX = /^\/(de|es|fr|ja|ko|ru|zh-Hant|zh|he)(?=\/|$)/;

    // Sections that exist in every locale, and the English-only extras.
    const SECTIONS = [
        { key: "wiki", path: "wiki/", title: "Wiki", description: "Encyclopedia entries: terms, figures, places and concepts, each with a claim-type label (direct / framework / inferred / speculative)." },
        { key: "timeline", path: "timeline/", title: "Timeline", description: "The twelve precessional World Ages as chapters, from the Age of Leo to the Age of Aquarius." },
        { key: "articles", path: "articles/", title: "Articles", description: "Long-form explainers: close readings of primary sources and comparative arguments." },
        { key: "library", path: "library/", title: "Library", description: "Digitized primary source texts (Genesis, Atrahasis, Gilgamesh, Enuma Elish, Enoch, the Raëlian books and more) with a reader." },
        { key: "sources", path: "sources/", title: "Sources", description: "The bibliography: every cited source with its stance, family and relation to the project." },
        { key: "news", path: "news/", title: "Newsroom", description: "Dispatches that read a current event through the project's framework." },
        { key: "faq", path: "faq/", title: "FAQ", description: "Frequently asked questions about the project and its position." },
        { key: "about", path: "about/", title: "About", description: "What the project is, who runs it, and its license (CC0)." },
        { key: "method", path: "method/", title: "Method", description: "The editorial method: claim types, the six-source rule, editorial passes." },
        { key: "datasets", path: "datasets/", title: "Datasets", description: "Citable comparative-mythology datasets (English only).", en_only: true },
        { key: "map", path: "map/", title: "Map", description: "The content graph and poster map of the corpus." }
    ];

    function getContext() {
        if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
        if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
        return null;
    }

    const ctx = getContext();
    if (!ctx || typeof ctx.registerTool !== "function") return;

    // One controller for every registration: aborting it unregisters all
    // tools (spec: ModelContextRegisterToolOptions.signal).
    const controller = new AbortController();
    const registered = [];

    // ---- helpers -----------------------------------------------------------

    function currentLang() {
        const htmlLang = document.documentElement.getAttribute("lang");
        if (htmlLang && LANGS.includes(htmlLang)) return htmlLang;
        const m = location.pathname.match(LANG_PREFIX);
        return m ? m[1] : "en";
    }

    function stripLang(pathname) {
        return pathname.replace(LANG_PREFIX, "") || "/";
    }

    function sectionOf(pathname) {
        const seg = stripLang(pathname).split("/").filter(Boolean)[0];
        return seg || "home";
    }

    function meta(name) {
        const el = document.querySelector('meta[name="' + name + '"]');
        return el ? el.getAttribute("content") : null;
    }

    function collapse(text) {
        return (text || "").replace(/\s+/g, " ").trim();
    }

    function clip(text, max) {
        if (!max || text.length <= max) return { text: text, truncated: false };
        return { text: text.slice(0, max), truncated: true };
    }

    function translations() {
        const out = {};
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (l) {
            const hl = l.getAttribute("hreflang");
            if (hl && hl !== "x-default") out[hl] = l.getAttribute("href");
        });
        return out;
    }

    function jsonTwin() {
        const l = document.querySelector('link[rel="alternate"][type="application/json"]');
        return l ? l.getAttribute("href") : null;
    }

    function claimType() {
        const active = document.querySelector(".claim-badge--active");
        if (!active) return null;
        const m = active.className.match(/claim-badge--(direct|framework|inferred|speculative)/);
        return m ? m[1] : null;
    }

    function sameOriginUrl(input) {
        let url;
        try {
            url = new URL(input, location.href);
        } catch (e) {
            throw new Error("Not a valid URL: " + input);
        }
        if (url.origin !== location.origin) {
            throw new Error("Only pages on " + location.origin + " can be opened; got " + url.origin);
        }
        return url;
    }

    function htmlToText(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("script, style").forEach(function (n) { n.remove(); });
        return collapse(doc.body ? doc.body.textContent : "");
    }

    function toolError(message, extra) {
        return Object.assign({ error: message }, extra || {});
    }

    // ---- site search (reuses the site's own Fuse index) --------------------

    function loadSiteSearch() {
        if (window.wohSearch) return Promise.resolve(window.wohSearch);
        if (typeof window.wohLoadSearchBundle === "function") {
            return window.wohLoadSearchBundle().then(function () {
                if (!window.wohSearch) throw new Error("Search bundle loaded without its programmatic API");
                return window.wohSearch;
            });
        }
        return Promise.reject(new Error("Site search is not available on this page"));
    }

    // ---- MCP server proxy (Streamable HTTP, lazy session) ------------------

    let session = null;        // { id: string }
    let sessionPromise = null;
    let rpcId = 0;

    function parseSse(text) {
        // Streamable HTTP answers POSTs with text/event-stream; each event
        // is one or more `data:` lines terminated by a blank line.
        const messages = [];
        let buf = [];
        const flush = function () {
            if (!buf.length) return;
            try { messages.push(JSON.parse(buf.join("\n"))); } catch (e) { /* skip non-JSON events */ }
            buf = [];
        };
        text.split(/\r?\n/).forEach(function (line) {
            if (line === "") { flush(); return; }
            if (line.indexOf("data:") === 0) buf.push(line.slice(5).replace(/^ /, ""));
        });
        flush();
        return messages;
    }

    async function rpc(message, signal) {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": MCP_PROTOCOL
        };
        if (session) headers["mcp-session-id"] = session.id;
        const res = await fetch(MCP_URL, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(message),
            signal: signal
        });
        if (res.status === 202) return { response: null, res: res };
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        let payload = null;
        if (ct.indexOf("text/event-stream") !== -1) {
            const wanted = parseSse(text).filter(function (m) { return m && m.id === message.id; });
            payload = wanted.length ? wanted[wanted.length - 1] : null;
        } else if (text) {
            try { payload = JSON.parse(text); } catch (e) { payload = null; }
        }
        if (!res.ok && !(payload && payload.error)) {
            throw new Error("MCP server answered HTTP " + res.status);
        }
        return { response: payload, res: res };
    }

    function isSessionError(err) {
        const msg = String((err && err.message) || err || "").toLowerCase();
        return msg.indexOf("session") !== -1 || msg.indexOf("http 404") !== -1;
    }

    function openSession(signal) {
        if (session) return Promise.resolve(session);
        if (sessionPromise) return sessionPromise;
        sessionPromise = (async function () {
            const id = ++rpcId;
            const init = await rpc({
                jsonrpc: "2.0",
                id: id,
                method: "initialize",
                params: {
                    protocolVersion: MCP_PROTOCOL,
                    capabilities: {},
                    clientInfo: { name: "wheelofheaven-webmcp", version: "1" }
                }
            }, signal);
            if (!init.response || init.response.error) {
                throw new Error("MCP initialize failed: " + JSON.stringify(init.response && init.response.error));
            }
            const sid = init.res.headers.get("mcp-session-id");
            if (!sid) throw new Error("MCP server issued no session id");
            session = { id: sid };
            await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, signal);
            return session;
        })();
        sessionPromise.catch(function () { sessionPromise = null; });
        return sessionPromise;
    }

    async function callServerTool(name, args, signal, retried) {
        await openSession(signal);
        const id = ++rpcId;
        let result;
        try {
            result = await rpc({
                jsonrpc: "2.0",
                id: id,
                method: "tools/call",
                params: { name: name, arguments: args || {} }
            }, signal);
        } catch (err) {
            if (!retried && isSessionError(err)) {
                session = null; sessionPromise = null;
                return callServerTool(name, args, signal, true);
            }
            throw err;
        }
        const msg = result.response;
        if (!msg) throw new Error("MCP server returned no response for " + name);
        if (msg.error) {
            if (!retried && isSessionError(msg.error)) {
                session = null; sessionPromise = null;
                return callServerTool(name, args, signal, true);
            }
            return toolError(msg.error.message || "MCP error", { code: msg.error.code, tool: name });
        }
        const r = msg.result || {};
        // Unwrap the MCP content envelope: the server answers with one text
        // block holding JSON. Hand the agent the parsed object when it is one.
        const blocks = Array.isArray(r.content) ? r.content : [];
        const texts = blocks.filter(function (b) { return b && b.type === "text"; }).map(function (b) { return b.text; });
        let payload = r.structuredContent;
        if (payload === undefined && texts.length === 1) {
            try { payload = JSON.parse(texts[0]); } catch (e) { payload = texts[0]; }
        } else if (payload === undefined) {
            payload = texts.length ? texts : r;
        }
        if (r.isError) return toolError("Tool reported an error", { tool: name, detail: payload });
        return payload;
    }

    // Copied from the server's tools/list (2026-09-19). Keep in sync.
    const SERVER_TOOLS = [
        {
            name: "search_corpus",
            description: "Full-text search over the Wheel of Heaven corpus: wiki encyclopedia entries, the precessional-ages timeline, digitized library source texts (Genesis, Atrahasis, Gilgamesh, Enuma Elish, Enoch, Raëlian books), research articles, and newsroom dispatches. Returns ranked matches with slug and section — use get_entry or get_passage to fetch full content. Corpus is CC0-licensed and citable by canonical URL.",
            inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, description: "Search terms, e.g. 'flood survivor vessel' or 'divine council'" }, section: { type: "string", enum: ["wiki", "timeline", "library", "articles", "news"], description: "Restrict to one section; omit to search everything" }, limit: { type: "integer", minimum: 1, maximum: 25, description: "Max results (default 8)" } }, required: ["query"], additionalProperties: false }
        },
        {
            name: "get_entry",
            description: "Fetch one Wheel of Heaven entry — an encyclopedia (wiki) entry, a precessional-age timeline chapter, a research article, or a newsroom dispatch — as markdown with its epistemic metadata: claim_type (direct / framework / inferred / speculative), editorial_pass, references, typed related-content edges, and the canonical citation URL. Every entry declares whether it states a textual fact, a framework premise, a reasonable inference, or interpretive synthesis.",
            inputSchema: { type: "object", properties: { section: { type: "string", enum: ["wiki", "timeline", "articles", "news"], description: "Content section the slug lives in" }, slug: { type: "string", minLength: 1, description: "Entry slug, e.g. 'elohim' — find slugs via search_corpus" }, lang: { type: "string", enum: ["en", "de", "fr", "es", "ru", "ja", "zh", "zh-Hant", "ko", "he"], description: "Language (default en). Untranslated entries return the languages that do exist." }, full_body: { type: "boolean", description: "Return the complete body instead of truncating at 8000 chars" } }, required: ["section", "slug"], additionalProperties: false }
        },
        {
            name: "get_passage",
            description: "Fetch a chapter of a digitized primary source text from the Wheel of Heaven library (Genesis, Atrahasis, Epic of Gilgamesh, Enuma Elish, the Book of Enoch, the Raëlian books, and ~120 more) as numbered paragraphs with stable reference IDs. Returns the text itself, not interpretation. Pass `ref` to narrow to one verse or paragraph. Book slugs come from search_corpus results in the library section.",
            inputSchema: { type: "object", properties: { book: { type: "string", minLength: 1, description: "Library book slug, e.g. 'genesis' or 'epic-of-gilgamesh'" }, chapter: { type: "integer", minimum: 1, description: "Chapter number (1-based)" }, ref: { type: "string", description: "Filter to paragraphs whose refId/verseRef contains this, e.g. 'GEN-1:26' or '1:26'" } }, required: ["book", "chapter"], additionalProperties: false }
        },
        {
            name: "get_source",
            description: "Look up the Wheel of Heaven bibliography (source program). Pass id for one full source record (description, author, publish date, licensing, link); pass query to search across titles, families, and stances. Every record carries its source_family, stance (supportive / neutral / critical / mixed), and relation_to_wheel — the bibliography deliberately includes critical and skeptical sources.",
            inputSchema: { type: "object", properties: { id: { type: "string", description: "Stable source ID, e.g. 'a-gentlemans-joyous-esotericism'" }, query: { type: "string", description: "Search terms matched against id, title, family, stance" }, limit: { type: "integer", minimum: 1, maximum: 50, description: "Max search results (default 10)" } }, additionalProperties: false }
        },
        {
            name: "compare_traditions",
            description: "Return rows from one of the Wheel of Heaven comparative-mythology datasets: myth-index (75 motif attestations across 9 families with Thompson Motif-Index cross-references), aarne-1910-tale-types (Aarne's 1910 folktale type catalogue), grimm-khm-index (the Grimm Kinder- und Hausmärchen with Aarne joins), antediluvian-chronologies (parallel pre-Flood king/patriarch lists), flood-myths, divine-council-index, theomachy-crossrefs, world-ages, prophets-and-religions. Source-grounded comparison tables linked to the digitized texts, with no interpretation applied. Use `filter` for a case-insensitive substring match across all row values.",
            inputSchema: { type: "object", properties: { dataset: { type: "string", enum: ["myth-index", "aarne-1910-tale-types", "grimm-khm-index", "antediluvian-chronologies", "flood-myths", "divine-council-index", "theomachy-crossrefs", "world-ages", "prophets-and-religions"], description: "Which comparative dataset" }, filter: { type: "string", description: "Case-insensitive substring match across row values, e.g. 'mesopotamian'" } }, required: ["dataset"], additionalProperties: false }
        },
        {
            name: "query_graph",
            description: "Query the typed Wheel of Heaven content graph: the 1-hop ego network of any corpus node, with typed edges (see_also, in_body, cites_source, same_tradition, same_age, comparison_of) in both directions. Use it to discover what an entry links to and what links to it, or to walk from a source to everything that cites it.",
            inputSchema: { type: "object", properties: { section: { type: "string", enum: ["wiki", "timeline", "articles", "news", "library"], description: "Section of the node" }, slug: { type: "string", minLength: 1, description: "Node slug, e.g. 'elohim'" }, edge_type: { type: "string", enum: ["see_also", "in_body", "cites_source", "same_tradition", "same_age", "comparison_of"], description: "Only return edges of this type" } }, required: ["section", "slug"], additionalProperties: false }
        },
        {
            name: "get_interpretation",
            description: "Return the Wheel of Heaven interpretive framework's reading of a topic — explicitly the project's own Raëlian-canon-centred position, NOT mainstream consensus. Framework topics (overview, hypothesis, terminology, timeline, sources, method) return curated context documents; any other topic returns the closest wiki entry's reading. Use the fact-layer tools (get_passage, compare_traditions) for source-grounded data without this framing.",
            inputSchema: { type: "object", properties: { topic: { type: "string", minLength: 1, description: "Framework topic or any concept, e.g. 'hypothesis' or 'flood'" } }, required: ["topic"], additionalProperties: false }
        },
        {
            name: "get_method",
            description: "Return the Wheel of Heaven editorial methodology: the claim_type taxonomy (direct/framework/inferred/speculative), the six-source rule (every new entry cites a Raëlian, an ancient-primary, a scholarly, a scientific, a comparative-tradition, and a critical source), editorial passes, and translation policy. Call this to understand how to weigh everything else the server returns.",
            inputSchema: { type: "object", properties: {} }
        },
        {
            name: "get_glossary_term",
            description: "Look up a core Wheel of Heaven term (Elohim, Yahweh, precession, World Ages, …) in the project glossary, returning its definition and renderings in all 9 site languages. Omit the term to list every glossary entry.",
            inputSchema: { type: "object", properties: { term: { type: "string", description: "Term or term-id to look up; omit to list all terms" } }, additionalProperties: false }
        }
    ];

    // ---- in-page tools -----------------------------------------------------

    const PAGE_TOOLS = [
        {
            name: "search_site",
            title: "Search this site",
            description: "Search this website's own index (the same one behind the search box) and get page URLs you can open with open_page. Covers every section in the reader's current language by default; the index holds each page's title and opening paragraphs. For ranked search over the full English corpus with slugs for get_entry / get_passage, use search_corpus instead.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", minLength: 1, description: "Search terms, e.g. 'flood' or 'Council of Eternals'" },
                    section: { type: "string", enum: ["wiki", "timeline", "articles", "library", "sources", "news"], description: "Restrict to one section; omit to search all" },
                    lang: { type: "string", description: "Site language code (en, de, es, fr, ja, ko, ru, zh, zh-Hant, he), or 'all'. Defaults to the current page's language." },
                    limit: { type: "integer", minimum: 1, maximum: 25, description: "Max results (default 8)" }
                },
                required: ["query"],
                additionalProperties: false
            },
            annotations: { readOnlyHint: true },
            execute: async function (input) {
                const search = await loadSiteSearch();
                await search.ready();
                const lang = input.lang || currentLang();
                const results = search.query(input.query, {
                    limit: input.limit || 8,
                    section: input.section || null,
                    lang: lang
                });
                return { query: input.query, lang: lang, count: results.length, results: results };
            }
        },
        {
            name: "get_current_page",
            title: "Describe the current page",
            description: "Return the structured metadata of the page currently open: URL, title, description, language, section, claim type (the page's declared epistemic status), the AI summary, the ai.* meta tags, the URLs of its translations, its JSON API twin, and the heading outline. Read-only; call get_page_text for the body.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true },
            execute: async function () {
                const ai = {};
                document.querySelectorAll('meta[name^="ai."]').forEach(function (m) {
                    ai[m.getAttribute("name")] = m.getAttribute("content");
                });
                const summaryEl = document.querySelector("[data-ai-summary]");
                const canonical = document.querySelector('link[rel="canonical"]');
                const headings = Array.from(document.querySelectorAll("#main-content h2, #main-content h3")).map(function (h) {
                    return { level: h.tagName.toLowerCase(), text: collapse(h.textContent), id: h.id || null };
                });
                return {
                    url: location.href,
                    canonical: canonical ? canonical.getAttribute("href") : location.href,
                    title: document.title,
                    description: meta("description"),
                    language: currentLang(),
                    section: sectionOf(location.pathname),
                    claim_type: claimType(),
                    summary: summaryEl ? collapse(summaryEl.textContent) : null,
                    ai_meta: ai,
                    translations: translations(),
                    json_twin: jsonTwin(),
                    headings: headings,
                    license: "CC0-1.0"
                };
            }
        },
        {
            name: "get_page_text",
            title: "Read the current page",
            description: "Return the main content of the page currently open as plain text (navigation, footer and scripts stripped). Read-only.",
            inputSchema: {
                type: "object",
                properties: {
                    max_chars: { type: "integer", minimum: 200, maximum: 200000, description: "Truncate after this many characters (default 12000)" }
                },
                additionalProperties: false
            },
            annotations: { readOnlyHint: true },
            execute: async function (input) {
                const main = document.getElementById("main-content") || document.querySelector("main") || document.body;
                const clone = main.cloneNode(true);
                clone.querySelectorAll("script, style, noscript, nav, .search-modal, .cite").forEach(function (n) { n.remove(); });
                const text = collapse(clone.innerText || clone.textContent);
                const c = clip(text, input.max_chars || 12000);
                return { url: location.href, title: document.title, chars: text.length, truncated: c.truncated, text: c.text };
            }
        },
        {
            name: "fetch_entry",
            title: "Fetch a page's JSON record",
            description: "Fetch the structured JSON record of a page from the static API (api.wheelofheaven.world/v1/): slug, title, description, claim_type, editorial_pass, references, see_also, typed related links, and the body as plain text. Defaults to the current page's JSON twin; pass a path such as 'wiki/elohim' or 'timeline/age-of-aquarius' for any other entry. Read-only.",
            inputSchema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "API path relative to /v1/, e.g. 'wiki/elohim', 'articles/', or 'library/books/'. Omit for the current page." },
                    include_body: { type: "boolean", description: "Include the body as plain text (default true)" },
                    max_chars: { type: "integer", minimum: 200, maximum: 200000, description: "Truncate the body after this many characters (default 12000)" }
                },
                additionalProperties: false
            },
            annotations: { readOnlyHint: true },
            execute: async function (input, options) {
                let url;
                if (input.path) {
                    url = new URL(input.path.replace(/^\/?(v1\/)?/, ""), API_BASE);
                    if (!/\/$/.test(url.pathname)) url.pathname += "/";
                } else {
                    const twin = jsonTwin();
                    if (!twin) return toolError("This page has no JSON API twin; pass a path such as 'wiki/elohim'.");
                    url = new URL(twin, location.href);
                }
                if (url.origin !== new URL(API_BASE).origin || url.pathname.indexOf("/v1/") !== 0) {
                    return toolError("Only paths under " + API_BASE + " can be fetched", { url: url.href });
                }
                const res = await fetch(url.href, { headers: { Accept: "application/json" }, signal: options && options.signal });
                if (!res.ok) return toolError("API answered HTTP " + res.status, { url: url.href });
                const record = await res.json();
                const data = record && record.data;
                if (data && typeof data === "object" && typeof data.body_html === "string") {
                    if (input.include_body !== false) {
                        const c = clip(htmlToText(data.body_html), input.max_chars || 12000);
                        data.body_text = c.text;
                        data.body_truncated = c.truncated;
                    }
                    delete data.body_html;
                }
                record.url = url.href;
                return record;
            }
        },
        {
            name: "list_sections",
            title: "List site sections",
            description: "List the site's sections with their URLs in the current language, plus the ten supported languages. Read-only.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true },
            execute: async function () {
                const lang = currentLang();
                const prefix = lang === "en" ? "/" : "/" + lang + "/";
                return {
                    language: lang,
                    languages: LANGS,
                    home: location.origin + prefix,
                    sections: SECTIONS.filter(function (s) { return !s.en_only || lang === "en"; }).map(function (s) {
                        return { key: s.key, title: s.title, url: location.origin + prefix + s.path, description: s.description };
                    }),
                    machine_readable: {
                        json_api: API_BASE,
                        mcp_server: MCP_URL,
                        llms_txt: location.origin + "/llms.txt",
                        api_catalog: location.origin + "/.well-known/api-catalog"
                    }
                };
            }
        },
        {
            name: "cite_current_page",
            title: "Cite the current page",
            description: "Return ready-made citations for the page currently open in APA, MLA, Chicago and BibTeX, exactly as the page's own Cite widget renders them. Read-only; returns an error on pages without a citation widget.",
            inputSchema: {
                type: "object",
                properties: {
                    format: { type: "string", enum: ["apa", "mla", "chicago", "bibtex"], description: "One format; omit for all four" }
                },
                additionalProperties: false
            },
            annotations: { readOnlyHint: true },
            execute: async function (input) {
                const out = {};
                document.querySelectorAll(".cite__format").forEach(function (block) {
                    const label = block.querySelector(".cite__format-label");
                    const text = block.querySelector(".cite__text");
                    if (label && text) out[collapse(label.textContent).toLowerCase()] = text.textContent.trim();
                });
                if (!Object.keys(out).length) return toolError("This page has no citation widget");
                if (input.format) {
                    return out[input.format] ? { format: input.format, citation: out[input.format] } : toolError("No " + input.format + " citation on this page");
                }
                return { url: location.href, license: "CC0-1.0", citations: out };
            }
        },
        {
            name: "open_page",
            title: "Open a page",
            description: "Navigate the browser to another page on this site. Accepts a path ('/wiki/elohim/') or an absolute URL on the same origin; anything off-site is refused. Navigating unloads the current page and its tools; the destination registers its own.",
            inputSchema: {
                type: "object",
                properties: { url: { type: "string", minLength: 1, description: "Same-site path or URL, e.g. '/timeline/age-of-aquarius/'" } },
                required: ["url"],
                additionalProperties: false
            },
            annotations: { readOnlyHint: false },
            execute: async function (input) {
                const url = sameOriginUrl(input.url);
                location.assign(url.href);
                return { navigating: true, url: url.href };
            }
        },
        {
            name: "switch_language",
            title: "Switch language",
            description: "Navigate to the translation of the current page in another site language, if one exists. Call get_current_page first to see which translations are available.",
            inputSchema: {
                type: "object",
                properties: { lang: { type: "string", enum: LANGS, description: "Target language code" } },
                required: ["lang"],
                additionalProperties: false
            },
            annotations: { readOnlyHint: false },
            execute: async function (input) {
                const available = translations();
                const target = available[input.lang];
                if (!target) return toolError("No " + input.lang + " translation of this page", { available: Object.keys(available) });
                const url = sameOriginUrl(target);
                location.assign(url.href);
                return { navigating: true, lang: input.lang, url: url.href };
            }
        }
    ];

    // ---- registration ------------------------------------------------------

    function register(tool) {
        let p;
        try {
            p = ctx.registerTool(tool, { signal: controller.signal });
        } catch (err) {
            p = Promise.reject(err);
        }
        return Promise.resolve(p).then(function () {
            registered.push(tool.name);
        }, function (err) {
            // A rejected registration (duplicate name, invalid schema) must not
            // take the others down with it.
            if (window.console && console.debug) console.debug("[webmcp] could not register " + tool.name + ":", err);
        });
    }

    const serverTools = SERVER_TOOLS.map(function (t) {
        return {
            name: t.name,
            title: t.name.replace(/_/g, " "),
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { readOnlyHint: true },
            execute: function (input, options) {
                return callServerTool(t.name, input || {}, options && options.signal);
            }
        };
    });

    const all = PAGE_TOOLS.concat(serverTools);
    const done = Promise.all(all.map(register)).then(function () {
        if (window.console && console.debug) console.debug("[webmcp] registered " + registered.length + "/" + all.length + " tools");
        return registered.slice();
    });

    window.wohWebMCP = {
        ready: done,
        tools: registered,
        dispose: function () { controller.abort(); }
    };
})();
