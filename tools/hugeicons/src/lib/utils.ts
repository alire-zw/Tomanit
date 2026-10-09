import * as fs from 'fs'

export function createFolderIfNotExists(path: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

export function nothing() {}

export function hyphenToCamelCase(str: string) {
  let tmp = ''
  let words = str.split('-')
  words.forEach((word) => {
    tmp += word.charAt(0).toUpperCase() + word.slice(1)
  })
  return tmp
}
