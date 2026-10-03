// One HTTP client for the NOHM server. Adds the bearer token, turns
// every failure into an ApiError with the server's `code`, and on a
// 401 that says the session expired refreshes once and retries, the way
// the app's dio_client does.
//
// Which 401s refresh: code SESSION_EXPIRED, or no code at all (a server
// from before the codes). Any other 401 (a wrong text code, say) is the
// answer to that request and is not sent again: a retry would spend
// another of the code's attempts.
//
// A paused, blocked or deleted account (a code starting ACCOUNT_, on the
// 401 itself or on a 403 from the refresh) signs the browser out and
// hands the server's message to onAccountStop, so the page can say why
// instead of quietly dropping the person at the sign-in screen.
//
// It never sends X-NOHM-Context: the server's CORS allowedHeaders
// (backend/src/main.ts) is ['Content-Type', 'Authorization'], so a
// browser preflight carrying it is refused and every call would fail.
// Without it the server uses the person's primary role (right for a
// homeowner; an account with both homeowner and property-manager hats
// gets the server's default side). Sending it needs one server line:
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-NOHM-Context'],

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

/** Whether a failed response should be answered with a token refresh. */
export function shouldRefresh(status, body) {
  if (status !== 401) return false;
  const code = body && body.code;
  return !code || code === 'SESSION_EXPIRED';
}

/** A paused, blocked or deleted account: ACCOUNT_PAUSED, ACCOUNT_BLOCKED, ACCOUNT_DELETED… */
export function isAccountStop(body) {
  return Boolean(body && typeof body.code === 'string' && body.code.startsWith('ACCOUNT_'));
}

function parse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function createHttp({ baseUrl, session, fetchImpl = fetch, onAccountStop = () => {} }) {
  const base = String(baseUrl).replace(/\/+$/, '');
  let refreshing = null;

  /** Signed out because of the account itself: say so, with the server's words. */
  function stop(status, body) {
    session.clear();
    const err = new ApiError(status, body, 'This account can’t be used right now.');
    err.accountStop = true;
    try { onAccountStop(err); } catch { /* the page's handler must not hide the error */ }
    return err;
  }

  /** Resolves true (new tokens), false (signed out), or an ApiError for a stopped account. */
  async function refresh() {
    if (!session.refreshToken) return false;
    if (!refreshing) {
      refreshing = (async () => {
        let res;
        try {
          res = await fetchImpl(`${base}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: session.refreshToken }),
          });
        } catch {
          return false; // offline: keep the session; the call's own 401 surfaces
        }
        if (!res.ok) {
          const body = parse(await res.text().catch(() => ''));
          if (res.status === 403 && isAccountStop(body)) return stop(403, body);
          session.clear();
          return false;
        }
        session.setTokens(await res.json());
        return true;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function send(method, path, { body, form, auth = true, retry = true } = {}) {
    const headers = {};
    const withToken = auth && Boolean(session.accessToken);
    if (withToken) headers.Authorization = `Bearer ${session.accessToken}`;
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
    const data = parse(await res.text());
    if (res.ok) return data;
    if (withToken && res.status === 401 && isAccountStop(data)) throw stop(401, data);
    if (withToken && retry && session.refreshToken && shouldRefresh(res.status, data)) {
      const r = await refresh();
      if (r instanceof ApiError) throw r;
      if (r) return send(method, path, { body, form, auth, retry: false });
    }
    throw new ApiError(res.status, data);
  }

  return {
    get: (path, opts) => send('GET', path, opts),
    post: (path, body, opts) => send('POST', path, { ...opts, body }),
    patch: (path, body, opts) => send('PATCH', path, { ...opts, body }),
    postForm: (path, form, opts) => send('POST', path, { ...opts, form }),
    delete: (path, opts) => send('DELETE', path, opts),
  };
}
