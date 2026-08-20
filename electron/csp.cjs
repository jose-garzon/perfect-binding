const { session } = require("electron");

/**
 * Content-Security-Policy is applied as a response header rather than a meta
 * tag, because the dev server injects an inline hot-reload script that a strict
 * policy would block. Pass the dev URL to relax the policy for that case.
 */
function applyCsp(devUrl) {
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval'${devUrl ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' data: blob:" + (devUrl ? " ws: http://localhost:*" : ""),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] },
    });
  });
}

module.exports = { applyCsp };
