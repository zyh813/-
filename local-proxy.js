// Simple HTTP/HTTPS proxy that forwards to an upstream proxy
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const PORT = process.env.PROXY_PORT || 18888;
const UPSTREAM = process.env.UPSTREAM_PROXY || "http://127.0.0.1:18080";

function parseUrl(url) {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port) || (u.protocol === "https:" ? 443 : 80), protocol: u.protocol.replace(":", "") };
}

const upstream = parseUrl(UPSTREAM);

console.log(`[local-proxy] Starting on port ${PORT}, forwarding to ${UPSTREAM}`);

const server = http.createServer((clientReq, clientRes) => {
  const targetUrl = new URL(clientReq.url);

  // Build request options for upstream proxy
  const options = {
    host: upstream.host,
    port: upstream.port,
    path: targetUrl.toString(),
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on("error", (err) => {
    console.error(`[local-proxy] Proxy error: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "text/plain" });
    }
    clientRes.end("Bad Gateway");
  });

  clientReq.pipe(proxyReq);
});

server.on("connect", (req, clientSocket, head) => {
  // HTTPS CONNECT tunneling through upstream proxy
  const [targetHost, targetPortStr] = req.url.split(":");
  const targetPort = targetPortStr ? parseInt(targetPortStr) : 443;

  const connOptions = {
    host: upstream.host,
    port: upstream.port,
    method: "CONNECT",
    path: `${targetHost}:${targetPort}`,
  };

  const connReq = http.request(connOptions);

  connReq.on("connect", (_res, serverSocket, _head) => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    serverSocket.write(head || "");
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  connReq.on("error", (err) => {
    console.error(`[local-proxy] CONNECT error: ${err.message}`);
    clientSocket.end();
  });

  connReq.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[local-proxy] Listening on http://127.0.0.1:${PORT}`);
});
