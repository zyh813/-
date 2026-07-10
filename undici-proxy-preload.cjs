// Preload script to make undici respect HTTP_PROXY/HTTPS_PROXY env vars
const { createRequire } = require("node:module");
const path = require("node:path");

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
const noProxy = process.env.NO_PROXY || process.env.no_proxy || "";

if (proxyUrl) {
  try {
    // Resolve undici from the api-server package
    const apiServerRequire = createRequire(path.join(__dirname, "artifacts/api-server/package.json"));
    const undici = apiServerRequire("undici");
    const { ProxyAgent, setGlobalDispatcher, fetch: undiciFetch } = undici;

    const noProxyList = noProxy.split(",").map(s => s.trim()).filter(Boolean);
    const shouldProxy = (hostname) => {
      return !noProxyList.some(pattern => {
        if (pattern.startsWith(".")) return hostname.endsWith(pattern) || hostname === pattern.slice(1);
        return hostname === pattern || hostname.endsWith("." + pattern);
      });
    };

    const proxyAgent = new ProxyAgent({ uri: proxyUrl });

    // Override global fetch to use proxy via undici
    const origFetch = globalThis.fetch;
    globalThis.fetch = function(input, init) {
      try {
        const url = typeof input === "string" ? new URL(input) : (input?.url ? new URL(input.url) : input);
        if (!shouldProxy(url.hostname)) {
          return origFetch(input, init);
        }
      } catch {}
      return undiciFetch(input, init);
    };

    setGlobalDispatcher(proxyAgent);
    console.log("[undici-proxy] Global dispatcher set to proxy:", proxyUrl);
  } catch (e) {
    console.log("[undici-proxy] Failed to set proxy:", e.message);
  }
}
