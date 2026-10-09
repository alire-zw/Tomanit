#!/usr/bin/env node

import readConfig from './src/lib/readConfig'
import generateReactNativeIcon from './src/react-native/index'
import generateReactIcon from './src/react/index'

let options = process.argv.slice(2)

const { targetPlatform = 'react' } = readConfig()

const iconName = options[0]
if (!iconName) {
  console.error('Please provide an icon name')
  process.exit(1)
}

switch (targetPlatform) {
  case 'react':
    generateReactIcon(iconName)
    break
  case 'react-native':
    generateReactNativeIcon(iconName)
    break
  default:
    console.error('Target platform `' + targetPlatform + '` is not supported')
    console.log('Supported platforms are `react` and `react-native`')
    console.log('Please specify one of the supported platforms in the configuration.')
    process.exit(1)
}
