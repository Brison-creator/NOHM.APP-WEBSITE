// /join/renter: a renter accepts the landlord's invite. The server
// links the lease; these screens carry the two codes.

import { h, field, button, clear } from '../../nohm/dom.js';
import { inviteCodeProblem, otpProblem, inviteLine } from '../lib/renter-flow.js';
import { prettyPhone, homeId } from '../../nohm/format.js';

function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

export function inviteScreen(a) {
  const wrap = h('section.b-screen');
  const err = h('p.b-err', { role: 'alert' });
  const list = h('div.b-list');
  const code = field({ label: 'Invite code', name: 'inviteCode', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code', hint: 'Six digits, in the text from your landlord.' });
  const btn = button('Continue', { key: 'next', submit: true });

  async function pick(inviteCode) {
    btn.busy(true, 'Checking…');
    try {
      const inv = await a.api.tenants.invite(inviteCode);
      await a.api.tenants.sendOtp(inviteCode);
      a.state.invite = { ...inv, inviteCode };
      a.go('confirm');
    } catch (ex) {
      err.textContent = ex.status === 404 ? 'No invite with that code for your number. Check the code, and that you signed up with the phone your landlord has.' : ex.message;
    } finally { btn.busy(false); }
  }
  const onSubmit = () => {
    const p = inviteCodeProblem(code.value);
    if (p) return code.setError(p);
    code.setError('');
    pick(code.value.trim());
  };

  a.api.tenants.myInvites().then((rows) => {
    for (const inv of rows || []) {
      list.append(h('button.b-choice', { type: 'button', dataset: { invite: inv.inviteCode }, onClick: () => pick(inv.inviteCode) }, [h('span', [h('b', inv.propertyAddress || ''), h('small', [inv.landlordName ? `${inv.landlordName} · ` : '', inviteLine(inv)])]), h('span.b-chev', '›')]));
    }
    if (list.children.length) wrap.insertBefore(h('p.b-line', 'We found your invite. Tap it, or enter the code below.'), list);
  }).catch(() => undefined);

  wrap.append(
    head('Your landlord invited you.', `Invites match the phone on your account, ${a.state.user ? prettyPhone(a.state.user.phone) : 'your number'}.`),
    list,
    h('form.b-form', { onSubmit: (e) => { e.preventDefault(); onSubmit(); } }, [code.el, err, h('div.b-foot', [btn])]),
    h('p.b-small', ['No code yet? Ask your landlord to add you in NOHM. ', h('a', { href: '/renters' }, 'What renters get'), '.']),
    h('p.b-small', ['Signed in as ', h('b', a.state.user ? a.state.user.email || prettyPhone(a.state.user.phone) : ''), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
  );
  return wrap;
}

export function confirmScreen(a) {
  const inv = a.state.invite || {};
  const otp = field({ label: 'Code we just texted you', name: 'otpCode', inputmode: 'numeric', maxlength: 8, autocomplete: 'one-time-code' });
  const err = h('p.b-err', { role: 'alert' });
  const btn = button('Accept the lease', { key: 'accept', submit: true });
  const onSubmit = async () => {
    const p = otpProblem(otp.value);
    if (p) return otp.setError(p);
    btn.busy(true, 'Linking…');
    try {
      const r = await a.api.tenants.accept(inv.inviteCode, otp.value.trim());
      a.state.linked = r;
      await a.refresh();
      a.go('done');
    } catch (ex) { otp.setError(ex.message); } finally { btn.busy(false); }
  };
  setTimeout(() => otp.input.focus(), 0);
  return h('section.b-screen', [
    head('One more code.', 'Your landlord’s invite is real; now we make sure it’s you.'),
    h('div.b-card', [h('b', inv.propertyAddress || ''), h('p', [inv.landlordName ? `Landlord: ${inv.landlordName}` : '', inv.rentAmount ? ` · ${inviteLine(inv)}` : ''])]),
    h('form.b-form', { onSubmit: (e) => { e.preventDefault(); onSubmit(); } }, [otp.el, h('button.b-link', { type: 'button', onClick: () => a.run(() => a.api.tenants.sendOtp(inv.inviteCode), err, 'Sent another code.') }, 'Send a new code'), err, h('div.b-foot', [button('Back', { kind: 'sec', onClick: () => a.go('invite') }), btn])]),
  ]);
}

export function doneScreen(a) {
  const prop = (a.state.myProperty && a.state.myProperty.property) || {};
  const lease = (a.state.myProperty && a.state.myProperty.lease) || {};
  const landlord = a.state.myProperty && a.state.myProperty.landlord;
  return h('section.b-screen', [
    head('You’re in.', 'Your lease is on NOHM.'),
    h('div.b-card', [h('b', prop.address || ''), lease.rentAmount ? h('p', inviteLine({ rentAmount: lease.rentAmount, leaseDueDay: lease.dueDay, leaseStartDate: lease.startDate })) : null, landlord ? h('p.b-small', `Landlord: ${landlord.name}`) : null, prop.hin ? h('p.b-small', `Home ID ${homeId(prop.hin)}`) : null]),
    h('div.b-card.blue', [h('b', 'Rent, repairs and your lease live in the app.'), h('p', 'Pay rent by bank transfer straight to your landlord, turn on autopay, send a repair request with photos, and keep every notice and document in one place.'), h('a.b-btn', { href: a.storeUrl() }, 'Get the NOHM app')]),
    h('p.b-small', ['Signed in as ', h('b', a.state.user ? a.state.user.email || prettyPhone(a.state.user.phone) : ''), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
  ]);
}
