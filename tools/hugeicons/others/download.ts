import { variants } from './constants'
import icon from './icons.json'
import fs from 'fs'

// Clean up the icons folder
// fs.rmdirSync('./icons', { recursive: true })

for (const variant of variants) {
  if (!fs.existsSync(`./icons/${variant}`)) fs.mkdirSync(`./icons/${variant}`, { recursive: true })
}

if (!fs.existsSync(`./icons/all`)) fs.mkdirSync(`./icons/all`, { recursive: true })

let downloadCount = 0
async function download() {
  const downloadPromises: Promise<any>[] = []
  for (const iconName of icon) {
    for (const variant of variants) {
      // Check if the icon exists
      const iconPath = `./icons/${variant}/${iconName}-${variant}.svg`
      if (fs.existsSync(iconPath)) {
        console.log(`${downloadCount}\tSkipping... ${iconName}-${variant}.svg`)
        downloadCount++
        continue
      }

      // Download the icon
      const url = `https://cdn.hugeicons.com/icons/${iconName}-${variant}.svg`
      console.log(`${downloadCount}\tDownloading... ${iconName}-${variant}.svg`)
      const downloadPromise = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          const filename = url.split('/').pop()
          return Promise.all([
            fs.promises.writeFile(`./icons/${variant}/${filename}`, new Uint8Array(buffer)),
            fs.promises.writeFile(`./icons/all/${filename}`, new Uint8Array(buffer)),
          ])
        })
      downloadPromises.push(downloadPromise)
      downloadCount++
      // await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    await Promise.all(downloadPromises)
  }
}

download()
