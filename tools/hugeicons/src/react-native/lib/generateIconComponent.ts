import { Variant, configuredVariants } from '../../lib/constants'
import { defaultParameters } from './constants'

export function generateIconComponent(icons: { variant: Variant; icon: string }[], pascalCaseIconName: string) {
  return `
import React from 'react'
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Mask, Path, Polygon, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
${configuredVariants.map((v, i) => `\t'${v}': ${icons[i].variant},`).join('\n')}
}

export default function ${pascalCaseIconName}Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant] || iconMap[defaultVariant] || StrokeRounded
  return <Component {...rest} />
}

${icons
  .map(
    ({ variant, icon }) => `function ${variant}(${defaultParameters}) {
  return (${icon})
}`,
  )
  .join('\n\n')}
`
}
