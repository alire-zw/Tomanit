import * as fs from 'fs'
import { defaultConfig } from '../lib/constants'
import fetchIcons from '../lib/fetchIcons'
import readConfig from '../lib/readConfig'
import { createFolderIfNotExists, hyphenToCamelCase } from '../lib/utils'
import { generateConstantsFile } from './lib/generateConstantsFile'
import { generateIconComponent } from './lib/generateIconComponent'
import { printCompletionMessage } from './lib/printCompletionMessage'
import { toReactNativeIcon } from './lib/toReactNativeIcon'

const { outputDir = defaultConfig.outputDir } = readConfig()

export default async function generateReactNativeIcon(iconName: string) {
  const pascalCaseIconName = hyphenToCamelCase(iconName)
  const icons = toReactNativeIcon(await fetchIcons(iconName))

  const ComponentPath = `${outputDir}/${pascalCaseIconName}Icon.tsx`
  console.log('📁 ' + ComponentPath)

  const output = generateIconComponent(icons, pascalCaseIconName)

  createFolderIfNotExists(outputDir)
  await fs.promises.writeFile(ComponentPath, output)

  generateConstantsFile()
  printCompletionMessage()
}
