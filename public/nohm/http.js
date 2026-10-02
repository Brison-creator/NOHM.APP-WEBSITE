// One HTTP client for the NOHM server. Adds the bearer token, turns
// every failure into an ApiError with the server's `code`, and on a
// 401 refreshes once and retries, the way the app's dio_client does.
//
// It never sends X-NOHM-Context (the server's CORS list doesn't allow
// it; without it the server uses the person's primary role, which for
// a homeowner is right).

export class ApiError extends Error {
  constructor(status, body, fallback) {
    const message = (body && typeof body.message === 'string' && body.message) || (Array.isArray(body && body.message) ? body.message.join(' ') : null) || fallback || `Request failed (${status})`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = (body && body.code) || null;
    this.body = body || null;
  }
}

export function createHttp({ baseUrl, session, fetchImpl = fetch }) {
  const base = String(baseUrl).replace(/\/+$/, '');
  let refreshing = null;

  async function refresh() {
    if (!session.refreshToken) return false;
    if (!refreshing) {
      refreshing = (async () => {
        const res = await fetchImpl(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!res.ok) {
          session.clear();
          return false;
        }
        const t = await res.json();
        session.setTokens(t);
        return true;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function send(method, path, { body, form, auth = true, retry = true } = {}) {
    const headers = {};
    if (auth && session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let payload;
    if (form) payload = form; // FormData: the browser sets the multipart boundary
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, { method, headers, body: payload });
    } catch (e) {
      throw new ApiError(0, null, "Can't reach NOHM right now. Check your connection and try again.");
    }
    if (res.status === 401 && auth && retry && session.refreshToken) {
      if (await refresh()) return send(method, path, { body, form, auth, retry: false });
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  return {
    get: (path, opts) => send('GET', path, opts),
    post: (path, body, opts) => send('POST', path, { ...opts, body }),
    patch: (path, body, opts) => send('PATCH', path, { ...opts, body }),
    postForm: (path, form, opts) => send('POST', path, { ...opts, form }),
    delete: (path, opts) => send('DELETE', path, opts),
  };
}
