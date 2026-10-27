#!/usr/bin/env python3
"""Daily ad and campaign report from nohm.app's own access logs (Amplify).

    python3 tools/ads/report.py                 # yesterday, Central time
    python3 tools/ads/report.py --day 2026-10-26
    python3 tools/ads/report.py --hours 6       # the last 6 hours

For each campaign page (the landlord ad page, the handyman page, /pro, /ig) it
counts real visitors, kept apart from Meta's link checkers and other robots,
and where they came from, their phones, how far they scrolled, which store
badge they tapped (the badges go through /get?to=...) and who reached the sign-up.
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
    '/pro/handyman': 'Handyman page',
    '/pro': 'Pro sign-up page',
    '/ig': 'Instagram link page',
}
BOT_WORDS = ('bot', 'crawler', 'spider', 'facebookexternalhit', 'meta-external', 'headless', 'curl', 'python', 'preview', 'scan')
UA_KEY = 'cs\\(User-Agent)'
REF_KEY = 'cs\\(Referer)'


def fetch_rows(start, end):
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
    return dict(up.parse_qsl(up.unquote(r.get('cs-uri-query', '') or '').replace('&amp;', '&')))


def page_of(stem):
    s = stem[:-len('index.html')] if stem.endswith('index.html') else stem
    s = s.rstrip('/') or '/'
    return s if s in PAGES else None


def is_doc(r):
    last = r['cs-uri-stem'].rsplit('/', 1)[-1]
    return '.' not in last or last.endswith('.html')


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
        return q['utm_source'].lower()
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
                'applied': any(r['cs-uri-stem'].startswith('/join') and 'from=pro' in up.unquote(r.get('cs-uri-query', '')) for r in after),
            })
        report[path] = visits
    # The landlord page's email form says "sent" with a HEAD to the page
    # (public/go/landlords/email.js): counted, never named.
    report['leads'] = collections.Counter(
        query(r).get('src', 'unknown') for r in rows
        if r.get('cs-method') == 'HEAD' and page_of(r['cs-uri-stem']) == '/go/landlords' and query(r).get('lead') == 'sent')
    return report


def summarize(report, label):
    lines = [f'NOHM ad report, {label}']
    leads = report.get('leads') or collections.Counter()
    for path, visits in report.items():
        if path == 'leads':
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
        if path == '/go/landlords':
            lines.append(f"  Scrolled down: {sum(1 for v in people if v['scrolled'])} of {len(people)}")
        taps = collections.Counter()
        for v in people:
            taps.update(v['taps'])
        tappers = sum(1 for v in people if v['taps'])
        if path == '/go/landlords':
            names = {'ios': 'App Store', 'android': 'Google Play', 'business': 'computer sign-in'}
            lines.append(f'  Tapped download: {tappers} of {len(people)}' + (' (' + ', '.join(f'{names.get(k, k)} {n}' for k, n in taps.items()) + ')' if taps else ''))
            lines.append(f"  Left their email: {sum(leads.values())}" + (' (' + ', '.join(f'{k} {n}' for k, n in leads.items()) + ')' if leads else '') + ' (each one is in the admin@nohm.app inbox)')
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
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    if a.hours:
        start, end = now - dt.timedelta(hours=a.hours), now
        label = f'the last {a.hours} hours'
    else:
        day = dt.date.fromisoformat(a.day) if a.day else (now.astimezone(CT) - dt.timedelta(days=1)).date()
        start = dt.datetime.combine(day, dt.time(0), CT).astimezone(dt.timezone.utc)
        end = min(start + dt.timedelta(days=1), now)
        label = day.strftime('%a %b %-d')
    rows = fetch_rows(start, end)
    print(summarize(build(rows), label))


if __name__ == '__main__':
    sys.exit(main())
