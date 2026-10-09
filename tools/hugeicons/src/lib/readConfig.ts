import * as fs from 'fs'
import { Variant } from './constants'

type Config = {
  outputDir: string
  targetPlatform: 'react' | 'react-native'
  defaultStrokeWidth: number
  defaultColor: string
  defaultSize: number
  defaultVariant: string
  variants: Variant[]
}

let config = {} as Config

export default function readConfig() {
  if (Object.keys(config).length > 0) return config

  if (!fs.existsSync('./hugeicons.config.json')) return config

  try {
    config = JSON.parse(fs.readFileSync('./hugeicons.config.json', 'utf8'))
  } catch (err) {
    console.log('Error reading config file: hugeicons.config.json')
    process.exit(1)
  }
  return config as Config
}
