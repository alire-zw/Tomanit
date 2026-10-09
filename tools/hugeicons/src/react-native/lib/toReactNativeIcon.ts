import { Variant, configuredVariants } from '../../lib/constants'
import { convertAttributesToCamelCase } from '../../lib/convertAttributesToCamelCase'
import { convertTagsToPascalCase } from '../../lib/convertTagsToPascalCase'
import { hyphenToCamelCase } from '../../lib/utils'

export function toReactNativeIcon(iconsData: string[]) {
  return iconsData.map((icon, index) => {
    const variant = configuredVariants[index]

    const processedIcon = icon
      .replace(/<\/?([a-z][\w-]*)([ >])/g, convertTagsToPascalCase)
      .replace(/(\s)([a-z][\w-]*-[a-z][\w-]*)(=)/g, convertAttributesToCamelCase)
      .replace(/<Svg /g, '<Svg className={className} style={style} ')
      .replace(/width="24"/g, 'width={size}')
      .replace(/height="24"/g, 'height={size}')
      .replace(/"#141B34"/g, '{color}')
      .replace(/strokeWidth="1.5"/g, 'strokeWidth={strokeWidth}')
      .replace(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')

    return {
      variant: hyphenToCamelCase(variant) as Variant,
      icon: processedIcon,
    }
  })
}
