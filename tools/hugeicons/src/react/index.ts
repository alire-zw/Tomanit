import * as fs from 'fs'
import { defaultConfig } from '../lib/constants'
import fetchIcons from '../lib/fetchIcons'
import readConfig from '../lib/readConfig'
import { createFolderIfNotExists, hyphenToCamelCase } from '../lib/utils'
import { generateConstantsFiles } from './lib/generateConstantsFiles'
import { generateIconComponent } from './lib/generateIconComponent'
import { printCompletionMessage } from './lib/printCompletionMessage'
import { toReactIcon } from './lib/toReactIcon'

const { outputDir = defaultConfig.outputDir } = readConfig()

export default async function generateReactIcon(iconName: string) {
  const pascalCaseIconName = hyphenToCamelCase(iconName)
  const icons = toReactIcon(await fetchIcons(iconName))

  const ComponentPath = `${outputDir}/${pascalCaseIconName}Icon.tsx`
  console.log('📁 ' + ComponentPath)

  const output = generateIconComponent({ icons, pascalCaseIconName })

  createFolderIfNotExists(outputDir)
  fs.writeFileSync(ComponentPath, output)

  generateConstantsFiles()
  printCompletionMessage()
}
