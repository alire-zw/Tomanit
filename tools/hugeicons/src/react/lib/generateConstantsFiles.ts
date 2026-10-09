import * as fs from 'fs'
import { allVariants, defaultConfig } from '../../lib/constants'
import readConfig from '../../lib/readConfig'

const {
  outputDir = defaultConfig.outputDir,
  defaultColor = defaultConfig.defaultColor,
  defaultStrokeWidth = defaultConfig.defaultStrokeWidth,
  defaultVariant = defaultConfig.defaultVariant,
  defaultSize = defaultConfig.defaultSize,
} = readConfig()

export function generateConstantsFiles() {
  const constantsPath = `${outputDir}/constants.ts`
  const constantsContent = `
export const variants = [
  ${allVariants.map((v) => `'${v}' as const`).join(',\n  ')}
]

export type Variant = (typeof variants)[number]

export type HugeIconProps = {
  variant?: Variant
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
} & React.SVGProps<SVGSVGElement>

export const defaultStrokeWidth = ${defaultStrokeWidth}
export const defaultColor = '${defaultColor}'
export const defaultVariant = '${defaultVariant}'
export const defaultSize = ${defaultSize}
`

  fs.writeFileSync(constantsPath, constantsContent)
  return { constantsPath, constantsContent }
}
