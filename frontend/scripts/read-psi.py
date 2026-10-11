import json
import sys
from pathlib import Path
from urllib.request import urlopen

url = (
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    "?url=https://tomanit.tunne.lol"
    "&strategy=mobile"
    "&category=performance"
    "&category=accessibility"
    "&category=best-practices"
    "&category=seo"
)

print("Fetching PageSpeed...", flush=True)
with urlopen(url, timeout=160) as res:
    data = json.load(res)

out = Path(__file__).with_name("psi-mobile.json")
out.write_text(json.dumps(data), encoding="utf-8")

lhr = data.get("lighthouseResult", {})
cats = lhr.get("categories", {})
print("URL:", data.get("id"))
print("fetchTime:", lhr.get("fetchTime"))
print("--- categories ---")
for key, val in cats.items():
    score = val.get("score")
    print(f"{key}: {round((score or 0) * 100)}")

aud = lhr.get("audits", {})
keys = [
    "first-contentful-paint",
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "speed-index",
    "interactive",
    "server-response-time",
    "render-blocking-resources",
    "unused-javascript",
    "unused-css-rules",
    "bootup-time",
    "mainthread-work-breakdown",
    "uses-text-compression",
    "uses-long-cache-ttl",
    "dom-size",
    "total-byte-weight",
    "redirects",
    "viewport",
    "uses-responsive-images",
    "modern-image-formats",
    "font-display",
    "third-party-summary",
    "network-requests",
]
print("--- audits ---")
for key in keys:
    a = aud.get(key) or {}
    if not a:
        continue
    print(f"{key}: {a.get('displayValue') or a.get('score')} | {a.get('title')}")

# Top opportunities
print("--- opportunities ---")
opps = []
for key, a in aud.items():
    details = a.get("details") or {}
    if details.get("type") == "opportunity" and (a.get("numericValue") or 0) > 0:
        opps.append((a.get("numericValue") or 0, key, a.get("title"), a.get("displayValue")))
opps.sort(reverse=True)
for _, key, title, disp in opps[:12]:
    print(f"{key}: {disp} | {title}")
