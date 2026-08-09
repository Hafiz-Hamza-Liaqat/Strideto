/** Prevent authenticated and session-bearing responses from being cached. */
export function setPrivateResponseHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export function privateResponse(_req, res, next) {
  setPrivateResponseHeaders(res);
  next();
}
