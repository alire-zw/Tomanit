import readConfig from './readConfig'

export const allVariants = [
  'stroke-rounded' as const,
  'stroke-standard' as const,
  'solid-standard' as const,
  'duotone-rounded' as const,
  'twotone-rounded' as const,
  'solid-rounded' as const,
  'bulk-rounded' as const,
  'stroke-sharp' as const,
  'solid-sharp' as const,
]

export type Variant = (typeof allVariants)[number]

export const URL = 'https://cdn.hugeicons.com/icons'

export const defaultConfig = {
  outputDir: './src/assets/icons/hugeicons',
  defaultColor: 'currentColor',
  defaultStrokeWidth: 1.5,
  defaultVariant: 'stroke-rounded',
  defaultSize: 24,
  variants: ['stroke-rounded', 'solid-rounded'] as Variant[],
}

// Cache configured variants globally - computed once and reused
let _configuredVariants: Variant[] | null = null

function computeConfiguredVariants(): Variant[] {
  const config = readConfig()
  
  if (config.variants && Array.isArray(config.variants)) {
    // Validate that all configured variants are valid
    const validVariants = config.variants.filter((v: string) => 
      allVariants.includes(v as Variant)
    ) as Variant[]
    return validVariants.length > 0 ? validVariants : defaultConfig.variants
  }
  
  return defaultConfig.variants
}

export function getConfiguredVariants(): Variant[] {
  if (_configuredVariants === null) {
    _configuredVariants = computeConfiguredVariants()
  }
  return _configuredVariants
}

// Global cached variants - computed once when first accessed
export const configuredVariants = getConfiguredVariants()
