// A NOHM Reddit post's code: the post's "Get NOHM" link counts the click
// on the server and lands here as /book?ref=<code> ("rd" and 6 letters
// or digits). The tab keeps it (sessionStorage, never the next
// visitor's) and the sign-up's last step sends it, so the post gets
// the credit for the account. Only that shape is ever kept or sent.

const KEY = 'nohm.signupRef';
export const SIGNUP_REF = /^rd[a-z2-9]{6}$/;

/** Keep `?ref=` from the address, if it is a post's code. */
export function rememberSignupRef(search, store) {
  try {
    const ref = (new URLSearchParams(search || '').get('ref') || '').trim().toLowerCase();
    if (SIGNUP_REF.test(ref)) store.setItem(KEY, ref);
  } catch {
    // No storage (private mode): the sign-up just isn't credited.
  }
}

/** The code this tab came with, or null. */
export function signupRef(store) {
  try {
    const ref = store.getItem(KEY);
    return ref && SIGNUP_REF.test(ref) ? ref : null;
  } catch {
    return null;
  }
}
