"use strict";

class CookieJar {
  constructor() {
    /** @type {Map<string, string>} */
    this.cookies = new Map();
  }

  /**
   * @param {import('node-fetch').Response | Response} response
   */
  ingest(response) {
    const headers = response.headers;
    let setCookies = [];

    if (typeof headers.getSetCookie === "function") {
      setCookies = headers.getSetCookie();
    } else {
      const raw = headers.get("set-cookie");
      if (raw) {
        setCookies = raw.split(/,(?=\s*[^;,=\s]+=)/);
      }
    }

    for (const cookie of setCookies) {
      const pair = cookie.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  toHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  snapshot() {
    return Object.fromEntries(this.cookies);
  }
}

module.exports = { CookieJar };
