// A small element builder so screens read as markup, not string
// concatenation, and nothing the person typed is ever inserted as HTML.
//
//   h('button.b-btn.sec', { onClick: fn, disabled: true }, 'Back')
//   h('div', [h('b', 'Title'), 'text'])

export function h(tag, attrs, children) {
  if (Array.isArray(attrs) || typeof attrs === 'string' || attrs instanceof Node) {
    children = attrs;
    attrs = {};
  }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  if (children === null || children === undefined) return el;
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** A labeled input; `field.input` is the element, `field.el` the wrapper. */
export function field({ label, type = 'text', name, value = '', placeholder = '', autocomplete, inputmode, required, maxlength, hint }) {
  const input = h(type === 'textarea' ? 'textarea' : 'input', {
    name, value, placeholder, autocomplete, inputmode, required, maxLength: maxlength, id: `f-${name}`,
    type: type === 'textarea' ? undefined : type,
  });
  const err = h('span.b-err', { id: `e-${name}`, role: 'alert' });
  const el = h('label.b-field', { htmlFor: `f-${name}` }, [h('span.b-label', label), input, hint ? h('span.b-hint', hint) : null, err]);
  return {
    el,
    input,
    get value() {
      return input.value;
    },
    setError(msg) {
      err.textContent = msg || '';
      el.classList.toggle('bad', Boolean(msg));
    },
  };
}

/** The blue button; `busy(true)` disables it and shows a spinner label. */
export function button(label, { kind = 'main', onClick, disabled = false, key, submit = false } = {}) {
  const b = h(`button.b-btn${kind === 'main' ? '' : '.' + kind}`, { type: submit ? 'submit' : 'button', onClick, disabled, dataset: key ? { key } : undefined }, label);
  let was = disabled;
  b.busy = (on, text) => {
    if (on) was = b.disabled;
    b.disabled = on ? true : was;
    b.textContent = on ? text || 'One moment…' : label;
  };
  return b;
}

export { money } from './format.js';
