import { Variant, configuredVariants } from '../../lib/constants'
import { defaultParameters } from './constants'

type Props = {
  icons: {
    variant: Variant
    icon: string
  }[]
  pascalCaseIconName: string
}

export function generateIconComponent({ icons, pascalCaseIconName }: Props) {
  return `
import React from 'react'
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
  .map(({ variant, icon }) => {
    return `
function ${variant}(${defaultParameters}) {
  return (${icon})
}`
  })
  .join('\n')}
`
}
