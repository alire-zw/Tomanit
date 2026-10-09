export function convertTagsToPascalCase(match: string, tagName: string, _: string) {
  if (match.startsWith('<?') || match.startsWith('<!')) {
    return match
  }
  const pascalTag = tagName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return match.replace(tagName, pascalTag)
}
