"use strict";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const DEFAULT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "development" ? "debug" : "info");

function timestamp() {
  return new Date().toISOString();
}

function serializeMeta(meta) {
  if (meta === undefined || meta === null) return "";
  try {
    return " " + JSON.stringify(meta);
  } catch {
    return " [meta-unserializable]";
  }
}

function createLogger(scope, minLevel = DEFAULT_LEVEL) {
  const threshold = LEVELS[minLevel] ?? LEVELS.info;

  function write(level, message, meta) {
    if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
    const line = `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}${serializeMeta(meta)}`;
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}

module.exports = { createLogger };
