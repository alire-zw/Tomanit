#!/usr/bin/env bun

import * as fs from 'fs'
import { getIconName, getVariant, importExportStr } from './util'

let options = process.argv.slice(2)

const iconName = getIconName(options[0])
const variant = getVariant(options[0])

const iconsListFilePath = './src/assets/icons/icons.ts'
const iconFile = `./src/assets/icons/src/${iconName + '-' + variant}.svg`

function main() {
  const iconListFileExist = fs.existsSync(iconsListFilePath)
  if (iconListFileExist) {
    const iconImportExportStatement = importExportStr(iconName, variant)
    // Check if the statement exists in the icons list if exists then delete that line from the list
    const iconList = fs.readFileSync(iconsListFilePath, 'utf-8')
    if (iconList.includes(iconImportExportStatement)) {
      const newIconList = iconList.replace(iconImportExportStatement, '')
      fs.writeFileSync(iconsListFilePath, newIconList)
      console.log('Icon removed from the list')
    } else console.error('Icon does not exist in the list')
  } else console.error('Icons list file does not exist')

  const iconExists = fs.existsSync(iconFile)
  if (!iconExists) {
    console.error('Icon file does not exist')
    return
  }
  fs.unlinkSync(iconFile)
  console.log('Icon svg file removed')
}

main()
