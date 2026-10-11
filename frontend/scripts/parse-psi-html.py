from pathlib import Path
import re
import os

html_path = Path(os.environ.get("TEMP", ".")) / "psi.html"
html = html_path.read_text(encoding="utf-8", errors="ignore")
print("len", len(html))

patterns = [
    r"performance.{0,120}",
    r'"score":\s*0\.\d+',
    r"largest-contentful-paint",
    r"first-contentful-paint",
    r"Total Blocking Time",
    r"lighthouseResult",
    r"AF_initDataCallback",
]
for pat in patterns:
    ms = re.findall(pat, html, flags=re.I)
    print(pat, "count", len(ms))
    if ms:
        print(" sample:", ms[0][:180])

# Dump chunks around "categories"
for m in re.finditer(r"categories", html):
    start = max(0, m.start() - 40)
    print(html[start : m.start() + 200])
    break

# Try to find numeric scores near Performance label
for m in re.finditer(r"Performance|Accessibility|Best Practices|SEO", html):
    print("---", html[m.start() : m.start() + 120].replace("\n", " "))
