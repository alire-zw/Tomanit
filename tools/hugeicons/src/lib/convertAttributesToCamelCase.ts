export function convertAttributesToCamelCase(_: string, before: string, attr: string, after: string) {
  const camelAttr = attr.replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
  return `${before}${camelAttr}${after}`
}
