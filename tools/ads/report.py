#!/usr/bin/env python3
"""Daily ad and campaign report from nohm.app's own access logs (Amplify).

    python3 tools/ads/report.py                 # yesterday, Central time
    python3 tools/ads/report.py --day 2026-10-26
    python3 tools/ads/report.py --hours 6       # the last 6 hours
    python3 tools/ads/report.py --since 2026-10-28   # every day since, added up
    python3 tools/ads/report.py --json          # the numbers, for a script

For each campaign page (the landlord ad page, the handyman page, /pro, /ig) it
counts real visitors, kept apart from Meta's link checkers and other robots,
and where they came from, their phones, how far they scrolled, which store
badge they tapped (the badges go through /get?to=...) and who reached the sign-up.
On the landlord page it also says how far down people got (each part of the
page, from public/go/landlords/track.js), which questions they opened, how long
they stayed, and how the hero test's two headlines are doing.
No addresses or other identifiers are printed: visitors are counted, never named.

Needs the AWS CLI with amplify:GenerateAccessLogs on the NOHM.APP-WEBSITE app.
"""

import argparse
import collections
import csv
import datetime as dt
import io
import json
import subprocess
import sys
import urllib.parse as up
import urllib.request
from zoneinfo import ZoneInfo

APP_ID = 'd2wr7hulekko6k'
DOMAIN = 'nohm.app'
REGION = 'us-east-1'
CT = ZoneInfo('America/Chicago')

# Campaign pages, by path (no trailing slash), and what to call them.
PAGES = {
    '/go/landlords': 'Landlord ad page',
    '/join/landlord': 'Landlord sign-up page',
    '/start': 'Handout card page',
    '/pro/handyman': 'Handyman page',
    '/pro': 'Pro sign-up page',
    '/ig': 'Instagram link page',
}
# The landlord page's parts, top to bottom (data-seen in its HTML). 'free'
# (free, and how, under the hero) took the place of the old 'price' part
# lower down on 2026-10-29.
PARTS = [
    ('hero', 'Top'), ('free', 'Free, and how'), ('versus', 'Cheap vs NOHM'), ('screens', 'Every rental'), ('tenant-app', 'Tenant app'),
    ('nohmie', 'NOHMie'), ('autopilot', 'Autopilot'), ('anywhere', 'Anywhere'),
    ('steps', 'Start in minutes'), ('faq', 'Questions'), ('email', 'Email form'), ('final', 'Last button'),
]
STAYS = (10, 30, 60, 120, 300)
# The hero test's rule (owner, 2026-10-27: "what you will change automatic"):
# a headline wins once each has been seen by this many people and it gets
# people to act (sign up, download, email) at least this many times as often.
TEST_MIN_PEOPLE = 100
TEST_MIN_LIFT = 1.5
TEST_MIN_ACTIONS = 8
BOT_WORDS = ('bot', 'crawler', 'spider', 'facebookexternalhit', 'meta-external', 'headless', 'curl', 'python', 'preview', 'scan')
UA_KEY = 'cs\\(User-Agent)'
REF_KEY = 'cs\\(Referer)'


def fetch_rows(start, end):
    # One day at a time: the logs come a day's worth per request.
    rows, t = [], start
    while t < end:
        rows += fetch_span(t, min(t + dt.timedelta(days=1), end))
        t += dt.timedelta(days=1)
    return rows


def fetch_span(start, end):
    out = subprocess.run(
        ['aws', 'amplify', 'generate-access-logs', '--app-id', APP_ID, '--domain-name', DOMAIN,
         '--start-time', str(int(start.timestamp())), '--end-time', str(int(end.timestamp())),
         '--region', REGION, '--output', 'json'],
        check=True, capture_output=True, text=True)
    url = json.loads(out.stdout)['logUrl']
    with urllib.request.urlopen(url, timeout=120) as r:
        text = r.read().decode('utf-8', 'replace')
    return list(csv.DictReader(io.StringIO(text)))


def when(r):
    return dt.datetime.fromisoformat(f"{r['date']}T{r['time']}").replace(tzinfo=dt.timezone.utc)


def agent(r):
    return up.unquote(up.unquote(r.get(UA_KEY, '')))


def query(r):
    # The logs escape '=' as '\=' (seen\=hero&v\=b): the backslashes go first.
    q = up.unquote(r.get('cs-uri-query', '') or '').replace('\\', '').replace('&amp;', '&')
    return dict(up.parse_qsl(q))


def page_of(stem):
    s = stem[:-len('index.html')] if stem.endswith('index.html') else stem
    s = s.rstrip('/') or '/'
    return s if s in PAGES else None


def is_doc(r):
    # A HEAD to a page is one of its counts (a beacon), not a visit.
    if r.get('cs-method') == 'HEAD':
        return False
    last = r['cs-uri-stem'].rsplit('/', 1)[-1]
    return '.' not in last or last.endswith('.html')


def beacons(reqs, path):
    """A visitor's counts on a page: parts seen, questions opened, longest stay, test version, email sent."""
    seen, faq, stay, v, lead = set(), set(), 0, '', False
    for r in reqs:
        if r.get('cs-method') != 'HEAD' or page_of(r['cs-uri-stem']) != path:
            continue
        q = query(r)
        if q.get('seen'):
            seen.add(q['seen'])
        if q.get('faq'):
            faq.add(q['faq'])
        if q.get('stay', '').isdigit():
            stay = max(stay, int(q['stay']))
        if q.get('v') in ('a', 'b'):
            v = q['v']
        if q.get('lead') == 'sent':
            lead = True
    return seen, faq, stay, v, lead


def device(ua):
    if 'iPhone' in ua or 'iPod' in ua:
        d = 'iPhone'
    elif 'iPad' in ua:
        d = 'iPad'
    elif 'Android' in ua:
        d = 'Android'
    else:
        d = 'Computer'
    return d


def app_of(ua):
    if 'Instagram' in ua:
        return 'Instagram app'
    if 'FBAN' in ua or 'FBAV' in ua or 'FB_IAB' in ua:
        return 'Facebook app'
    return 'browser'


def source(q, ua, ref):
    if q.get('utm_source'):
        s = q['utm_source'].lower()
        return {'fb': 'facebook', 'ig': 'instagram'}.get(s, s)
    if 'fbclid' in q:
        return 'instagram' if 'Instagram' in ua else 'facebook'
    if q.get('from'):
        return q['from']
    host = up.urlparse(up.unquote(ref)).netloc if ref and ref != '-' else ''
    for site in ('facebook', 'instagram', 'google', 'bing', 'reddit', 'nextdoor'):
        if site in host:
            return site
    if host and not host.endswith('nohm.app'):
        return host
    return 'direct'


def build(rows):
    by_visitor = collections.defaultdict(list)
    for r in rows:
        by_visitor[(r['c-ip'], agent(r))].append(r)
    for reqs in by_visitor.values():
        reqs.sort(key=when)

    report = {}
    for path, name in PAGES.items():
        visits = []
        for key, reqs in by_visitor.items():
            ua = key[1]
            docs = [r for r in reqs if is_doc(r) and page_of(r['cs-uri-stem']) == path and r['sc-status'] in ('200', '304')]
            if not docs:
                continue
            first = docs[0]
            t0 = when(first)
            after = [r for r in reqs if t0 <= when(r) <= t0 + dt.timedelta(minutes=45)]
            assets = [r for r in after if not is_doc(r) and when(r) <= t0 + dt.timedelta(seconds=60)]
            robot = any(w in ua.lower() for w in BOT_WORDS) or not assets
            stems = ' '.join(r['cs-uri-stem'] for r in after)
            taps = collections.Counter()
            for r in after:
                if r['cs-uri-stem'].rstrip('/') == '/get':
                    q = query(r)
                    taps[q.get('to', 'phone picks')] += 1
            other = []
            for r in after:
                p = r['cs-uri-stem']
                if is_doc(r) and r['sc-status'] in ('200', '304') and page_of(p) != path and not p.startswith('/get'):
                    other.append(p.rstrip('/') or '/')
            q = query(first)
            seen, faq, stay, v, lead = beacons(after, path)
            visits.append({
                'robot': robot,
                'source': source(q, ua, first.get(REF_KEY, '')),
                'from': q.get('from', ''),
                'device': device(ua),
                'app': app_of(ua),
                'when': t0.astimezone(CT),
                'scrolled': 'lp-tenant-phone' in stems if path == '/go/landlords' else None,
                'taps': taps,
                'other': list(dict.fromkeys(other)),
                'applied': any(r['cs-uri-stem'].startswith('/join') and query(r).get('from') == 'pro' for r in after),
                'signup_opened': any(is_doc(r) and page_of(r['cs-uri-stem']) == '/join/landlord' for r in after) if path != '/join/landlord' else None,
                'seen': seen,
                'faq': faq,
                'stay': stay,
                'v': v,
                'lead': lead,
            })
        report[path] = visits
    # The landlord page's email form says "sent" with a HEAD to the page
    # (public/go/landlords/email.js): counted, never named.
    report['leads'] = collections.Counter(
        query(r).get('src', 'unknown') for r in rows
        if r.get('cs-method') == 'HEAD' and page_of(r['cs-uri-stem']) == '/go/landlords' and query(r).get('lead') == 'sent')
    # A new landlord account from /join/landlord (public/join/ui/landlord-screens.js).
    report['signups'] = collections.Counter(
        query(r).get('src', 'unknown') for r in rows
        if r.get('cs-method') == 'HEAD' and page_of(r['cs-uri-stem']) == '/join/landlord' and query(r).get('signup') == 'done')
    return report


def acted(v):
    """Did this landlord-page visitor do something: open the sign-up, tap a download, or leave their email."""
    return bool(v['signup_opened'] or v['taps'] or v['lead'])


def hero_test(visits):
    """Each headline: people, how many acted; and the winner by the rule above, or None."""
    people = [v for v in visits if not v['robot'] and v['v']]
    out = {}
    for k in ('a', 'b'):
        mine = [v for v in people if v['v'] == k]
        out[k] = {'people': len(mine), 'acted': sum(1 for v in mine if acted(v))}
    a, b = out['a'], out['b']
    winner = None
    if a['people'] >= TEST_MIN_PEOPLE and b['people'] >= TEST_MIN_PEOPLE:
        ra, rb = a['acted'] / a['people'], b['acted'] / b['people']
        for k, mine, other, n in (('a', ra, rb, a['acted']), ('b', rb, ra, b['acted'])):
            if n >= TEST_MIN_ACTIONS and mine >= other * TEST_MIN_LIFT and mine > other:
                winner = k
    out['winner'] = winner
    return out


def summarize(report, label):
    lines = [f'NOHM ad report, {label}']
    leads = report.get('leads') or collections.Counter()
    signups = report.get('signups') or collections.Counter()
    for path, visits in report.items():
        if path in ('leads', 'signups'):
            continue
        people = [v for v in visits if not v['robot']]
        robots = len(visits) - len(people)
        if not visits:
            continue
        name = PAGES[path]
        lines.append('')
        who = '1 person' if len(people) == 1 else f'{len(people)} people'
        lines.append(f'{name} (nohm.app{path}): {who}' + (f', {robots} robot checks left out' if robots else ''))
        if not people:
            continue
        src = collections.Counter(v['source'] for v in people)
        lines.append('  From: ' + ', '.join(f'{k} {n}' for k, n in src.most_common()))
        dev = collections.Counter(v['device'] for v in people)
        lines.append('  Phones: ' + ', '.join(f'{k} {n}' for k, n in dev.most_common()))
        # Scrolled: what track.js counts (a part past the top seen). Before it
        # ran, the lower phone picture loading stood in, but phones fetch it
        # without anyone scrolling, so it is only shown for those days.
        if path == '/go/landlords' and not any(v['seen'] for v in people):
            lines.append(f"  Lower pictures loaded (not a sure sign of scrolling): {sum(1 for v in people if v['scrolled'])} of {len(people)}")
        taps = collections.Counter()
        for v in people:
            taps.update(v['taps'])
        tappers = sum(1 for v in people if v['taps'])
        if path == '/go/landlords':
            names = {'ios': 'App Store', 'android': 'Google Play', 'business': 'computer sign-in'}
            lines.append(f'  Tapped download: {tappers} of {len(people)}' + (' (' + ', '.join(f'{names.get(k, k)} {n}' for k, n in taps.items()) + ')' if taps else ''))
            lines.append(f"  Opened sign up: {sum(1 for v in people if v['signup_opened'])} of {len(people)}")
            lines.append(f"  Left their email: {sum(leads.values())}" + (' (' + ', '.join(f'{k} {n}' for k, n in leads.items()) + ')' if leads else '') + ' (each one is in the admin@nohm.app inbox)')
            counted = [v for v in people if v['seen']]
            if counted:
                got = [(name, sum(1 for v in counted if key in v['seen'])) for key, name in PARTS]
                lines.append(f"  Scrolled past the top: {sum(1 for v in counted if v['seen'] - {'hero'})} of {len(counted)} counted")
                lines.append(f"  Looked 10 seconds or more: {sum(1 for v in counted if v['stay'] >= 10)} of {len(counted)}")
                lines.append(f'  How far down: ' + ', '.join(f'{name} {n}' for name, n in got))
                drops = [(got[i][1] - got[i + 1][1], got[i][0], got[i + 1][0]) for i in range(len(got) - 1)]
                drop = max(drops)
                if drop[0] > 0:
                    lines.append(f'  Most people left between {drop[1]} and {drop[2]} ({drop[0]} of them)')
                lines.append('  Stayed: ' + ', '.join(f"{s // 60}m+ {sum(1 for v in counted if v['stay'] >= s)}" if s >= 60 else f"{s}s+ {sum(1 for v in counted if v['stay'] >= s)}" for s in STAYS))
                faq = collections.Counter(q for v in counted for q in v['faq'])
                if faq:
                    lines.append('  Questions opened: ' + ', '.join(f'{k} {n}' for k, n in faq.most_common()))
                t = hero_test(visits)
                lines.append(f"  Headline test: A (finally in your area) {t['a']['acted']} of {t['a']['people']} acted, B (rent in, repairs handled) {t['b']['acted']} of {t['b']['people']}"
                             + (f"; winner {t['winner'].upper()}" if t['winner'] else f'; no winner yet (needs {TEST_MIN_PEOPLE} people each)'))
        if path == '/join/landlord':
            lines.append(f"  New landlord accounts: {sum(signups.values())}" + (' (' + ', '.join(f'{k} {n}' for k, n in signups.items()) + ')' if signups else ''))
        if path.startswith('/pro'):
            lines.append(f"  Sent the pro form (went on to sign-up): {sum(1 for v in people if v['applied'])}")
        went = collections.Counter(p for v in people for p in v['other'] if not p.startswith('/join'))
        if went:
            lines.append('  Also opened: ' + ', '.join(f'{k} {n}' for k, n in went.most_common(5)))
        hours = collections.Counter(v['when'].strftime('%-I %p') for v in people)
        lines.append('  Busiest hour: ' + ', '.join(f'{k} ({n})' for k, n in hours.most_common(2)))
    if len(lines) == 1:
        lines.append('No visits to the campaign pages.')
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--day', help='a Central-time day, YYYY-MM-DD (default: yesterday)')
    ap.add_argument('--hours', type=int, help='the last N hours instead of a day')
    ap.add_argument('--since', help='every day from this Central-time day, YYYY-MM-DD, to now')
    ap.add_argument('--json', action='store_true', help='print the counts as JSON (no visitor detail)')
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    if a.since:
        start = dt.datetime.combine(dt.date.fromisoformat(a.since), dt.time(0), CT).astimezone(dt.timezone.utc)
        end = now
        label = f'since {dt.date.fromisoformat(a.since).strftime("%a %b %-d")}'
    elif a.hours:
        start, end = now - dt.timedelta(hours=a.hours), now
        label = f'the last {a.hours} hours'
    else:
        day = dt.date.fromisoformat(a.day) if a.day else (now.astimezone(CT) - dt.timedelta(days=1)).date()
        start = dt.datetime.combine(day, dt.time(0), CT).astimezone(dt.timezone.utc)
        end = min(start + dt.timedelta(days=1), now)
        label = day.strftime('%a %b %-d')
    rows = fetch_rows(start, end)
    report = build(rows)
    if a.json:
        print(json.dumps(as_json(report, label), indent=2))
    else:
        print(summarize(report, label))


def as_json(report, label):
    """The counts only: what the morning task reads to decide the hero test."""
    out = {'label': label, 'leads': dict(report['leads']), 'signups': dict(report['signups']), 'pages': {}}
    for path in PAGES:
        people = [v for v in report[path] if not v['robot']]
        out['pages'][path] = {'people': len(people), 'robots': len(report[path]) - len(people),
                              'acted': sum(1 for v in people if acted(v)) if path == '/go/landlords' else None}
    out['hero_test'] = hero_test(report['/go/landlords'])
    return out


if __name__ == '__main__':
    sys.exit(main())
