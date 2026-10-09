// const icons = await import('./tmp/hugeicons.com.json')
const icons = await import('./tmp/hugeicons.com_firefox.json')

import fs from 'node:fs'

//@ts-ignore

const entries = icons.log.entries

console.log(entries.length)

const iconsList = entries.map((entry: any) => {
  const { request } = entry
  const url = request.url
  if (url.startsWith('https://cdn.hugeicons.com/icons/')) {
    let iconName = url.split('/').pop()
    iconName = iconName.split('.')[0]
    iconName = iconName.split('-stroke-rounded')[0]
    return iconName
  }
})

const iconsSet = new Set(iconsList)
console.log(iconsSet.size)

// Save this to a file
fs.writeFileSync('icons.json', JSON.stringify([...iconsSet], null, 2))
