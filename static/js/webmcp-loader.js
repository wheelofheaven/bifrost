// Loads the WebMCP tool bundle only where an agent can use it. The spec
// (https://webmachinelearning.github.io/webmcp/) puts the entry point on
// `document.modelContext`; the older `navigator.modelContext` is what
// polyfills and readiness scanners shim into browsers with no native API.
// Either one means an agent is listening, so fetch webmcp.bundle.js and let
// it register the tools. Everyone else pays for this stub alone.
//
// The bundle is loaded with a manual `?v=N` tag under a 7-day CDN cache —
// bump it when static/js/webmcp.js changes (same trap as search-loader.js).
(function () {
    if (!(document.modelContext || navigator.modelContext)) return;
    const s = document.createElement("script");
    s.src = "/js/dist/webmcp.bundle.js?v=1";
    s.async = true;
    document.head.appendChild(s);
})();
