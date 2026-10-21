// The spam checks' decoy and clock, for the forms that send a text or
// email code, a message or an application (/book, /join, /join/renter,
// /pro, /rentals). A text field people never see, and how long the form
// was on screen, go to the server as `formTrap: { hp, ms }` on exactly
// the requests that take it (docs/spam-protection.md); any other request
// would be refused for an unknown field. The server decides what they
// mean: nothing here blocks a send.
//
//   const trap = addFormTrap(formEl);     // the decoy goes in last; the clock starts
//   body = { ...body, ...trap.fields() }  // { formTrap: { hp: '', ms: 5321 } }
//   trap.restart();                       // a new step of the same screen is shown
//
// The decoy sits off-screen (not display:none), hidden from screen
// readers, out of the tab order, with a name and label no browser or
// password manager fills. Elements only, never HTML strings. The pure
// helpers at the top run in Node (tools/book/form-traps.test.mjs).

/** The decoy's name: nothing browsers or password managers autofill. */
export const TRAP_NAME = 'nohm_extra_field';
/** Its label, read by nobody but a bot. */
export const TRAP_LABEL = 'Leave this empty';
/** The largest `ms` sent: a 32-bit int (about 24.8 days). */
export const MAX_MS = 2147483647;

/** Whole milliseconds from `start` to `now` (performance.now() readings), never negative. */
export function elapsedMs(start, now) {
  const d = Number(now) - Number(start);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.min(MAX_MS, Math.round(d));
}

/** The body field for one send: the decoy's value as typed ('' when empty) and the time on screen. */
export function trapFields(hp, start, now) {
  return { formTrap: { hp: hp == null ? '' : String(hp), ms: elapsedMs(start, now) } };
}

/**
 * `{ formTrap }` from a trap's fields(), or {} when there is none: what
 * the request bodies spread in, so nothing else rides along.
 */
export function formTrapField(fields) {
  const t = fields && fields.formTrap;
  if (!t || typeof t.hp !== 'string' || !Number.isInteger(t.ms) || t.ms < 0) return {};
  return { formTrap: { hp: t.hp, ms: t.ms } };
}

// Off-screen rather than display:none or hidden, which bots skip.
const OFF_SCREEN = { position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' };

/**
 * One decoy and its clock: { el, input, restart(), attach(container), fields() }.
 * `el` goes at the end of the form (after the password field, so a
 * password manager never takes it for the username); one per screen,
 * moved from form to form with attach() or placed with `el`.
 * `doc` and `now` are for tests.
 */
export function formTrap({ doc = globalThis.document, now = () => globalThis.performance.now() } = {}) {
  const el = doc.createElement('div');
  el.className = 'nohm-trap';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, OFF_SCREEN);
  const input = doc.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('name', TRAP_NAME);
  input.setAttribute('tabindex', '-1');
  input.setAttribute('autocomplete', 'off');
  // Password managers' own "leave this alone" marks (LastPass, 1Password, Bitwarden, Dashlane).
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-1p-ignore', 'true');
  input.setAttribute('data-bwignore', 'true');
  input.setAttribute('data-form-type', 'other');
  const label = doc.createElement('label');
  label.append(doc.createTextNode(TRAP_LABEL), input);
  el.append(label);
  let start = now();
  return {
    el,
    input,
    /** A new form step is on screen: time it from now. The decoy keeps its value. */
    restart() {
      start = now();
    },
    /** Put the decoy at the end of `container` (moving it if it was elsewhere) and restart the clock. */
    attach(container) {
      container.append(el);
      start = now();
      return container;
    },
    /** `{ formTrap: { hp, ms } }` for the request being sent now. */
    fields() {
      return trapFields(input.value, start, now());
    },
  };
}

/** A decoy at the end of `container`, timed from now. */
export function addFormTrap(container, opts) {
  const trap = formTrap(opts);
  trap.attach(container);
  return trap;
}
