import { defaultVariant, variants, type Variant } from './constants'

export function importExportStr(iconName: string, variant: string) {
  return `export { default as ${getCamelIconName(iconName, variant)} } from '@icons/${iconName}-${variant}.svg'`
}

export function importStr(iconName: string, variant: string) {
  return `import ${getCamelIconName(iconName, variant)} from '@icons/${iconName}-${variant}.svg'`
}

export function getCamelIconName(str: string, variant: string) {
  let camelIconName = hyphenToCamelCase(str)
  if (variant === defaultVariant) nothing()
  else if (variant === 'solid-rounded') camelIconName += 'Solid'
  else camelIconName += hyphenToCamelCase(variant)
  return camelIconName + 'Icon'
}

export function hyphenToCamelCase(str: string) {
  let tmp = ''
  let words = str.split('-')
  words.forEach((word) => {
    tmp += word.charAt(0).toUpperCase() + word.slice(1)
  })
  return tmp
}

export function getVariant(iconName: string) {
  const icon = iconName.split('-')
  // If the length of the list is less than 2 that means the variant is not given
  if (icon.length < 2) return defaultVariant
  const variant = icon.at(-2) + '-' + icon.at(-1) // Get the last two elements
  // Check if the variant is valid
  // If the variant is not valid then the variant is not given
  if (!variants.includes(variant as Variant)) return defaultVariant
  return variant
}

export function getIconName(iconName: string) {
  const icon = iconName.split('-')
  if (icon.length < 2) return iconName // does not have a variant
  const variant = getVariant(iconName)
  if (iconName.endsWith(`-${variant}`)) {
    // Remove the variant from the icon name
    icon.pop()
    icon.pop()
  }
  return icon.join('-')
}

export function nothing() {}
