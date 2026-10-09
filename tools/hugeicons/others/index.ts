#!/usr/bin/env bun

import * as fs from 'fs'
import { defaultVariant, variants, type Variant } from './constants'
import { importExportStr, importStr } from './util'

const URL = 'https://cdn.hugeicons.com/icons'

const defaults = {
  iconName: '',
  strokeWidth: 1.5,
  color: 'currentColor',
  variant: defaultVariant,
  outputDir: './src/assets/icons/src',
}

let options = process.argv.slice(2)
// console.log('options:', options)

let color = defaults.color
let strokeWidth = defaults.strokeWidth
let variant: Variant = defaults.variant
export let outputDir = defaults.outputDir

for (let i = 1; i < options.length; i++) {
  const val = options[i] as Variant
  if (val.startsWith('#')) {
    color = val
    continue
  }
  if (!isNaN(parseFloat(val))) {
    strokeWidth = parseFloat(val)
    continue
  }
  if (variants.includes(val as Variant)) {
    variant = val
    continue
  }
  if (val.includes('/')) {
    outputDir = val
    continue
  }
}

let iconName = options[0]

const fillColor = { form: `fill="#141B34"`, to: `fill="${color}"` }
const strokeWidthConvert = { form: `stroke-width="1.5"`, to: `stroke-width="${strokeWidth}"` }
const strokeColorConvert = { from: `stroke="#141B34"`, to: `stroke="${color}"` }

export function createFolderIfNotExists(path: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

export function replaceIconContent(iconString: string): string {
  return iconString
    .replace(new RegExp(fillColor.form, 'g'), fillColor.to)
    .replace(new RegExp(strokeWidthConvert.form, 'g'), strokeWidthConvert.to)
    .replace(new RegExp(strokeColorConvert.from, 'g'), strokeColorConvert.to)
}

async function main() {
  if (!iconName) {
    console.error('Please enter icon name to continue')
  } else {
    const iconPath = `${outputDir}/${iconName}-${variant}.svg`
    writeConsoleMessages(iconPath)
    const url = `${URL}/${iconName}-${variant}.svg`
    const iconData = await fetch(url)

    exitIfError(iconData)
    await writeToFile(iconPath, iconData)
    console.log()
    // copyClipboard()
    updateIconsList()
  }
}
main()

function updateIconsList() {
  const iconsListFilePath = './src/assets/icons/icons.ts'

  if (!fs.existsSync(iconsListFilePath)) fs.writeFileSync(iconsListFilePath, '')
  const iconStr = importExportStr(iconName, variant)

  const iconsList = fs.readFileSync(iconsListFilePath, 'utf-8')
  if (iconsList.includes(iconStr)) return // if icon already exists in the list

  fs.appendFileSync(iconsListFilePath, iconStr + '\n')
}

function exitIfError(iconData: Response) {
  if (!iconData.ok) {
    console.error(`Icon ${iconName}-${variant}.svg not found\n`)
    process.exit(1)
  }
}

async function writeToFile(iconPath: string, iconData: Response) {
  const iconStr = replaceIconContent(await iconData.text())
  createFolderIfNotExists(outputDir)
  if (fs.existsSync(iconPath)) console.log('\nIcon 🟢 updated')
  fs.writeFileSync(iconPath, iconStr)
}

function copyClipboard() {
  const str = importStr(iconName, variant)
  const proc = require('child_process').spawn('clip')
  proc.stdin.write(str)
  proc.stdin.end()
}

function writeConsoleMessages(iconPath: string) {
  console.log()
  console.log('📛', iconName, '🖌️ ', strokeWidth, ' 🎨', color, '🪆 ', variant)
  console.log('📂', iconPath)
}
