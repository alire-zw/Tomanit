
export const variants = [
  'stroke-rounded' as const,
  'stroke-standard' as const,
  'solid-standard' as const,
  'duotone-rounded' as const,
  'twotone-rounded' as const,
  'solid-rounded' as const,
  'bulk-rounded' as const,
  'stroke-sharp' as const,
  'solid-sharp' as const
]

export type Variant = (typeof variants)[number]

export type HugeIconProps = {
  /** Accept string so callers/tiles don't need Variant narrowing. */
  variant?: Variant | string
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
} & React.SVGProps<SVGSVGElement>

export const defaultStrokeWidth = 1.5
export const defaultColor = 'currentColor'
export const defaultVariant = 'bulk-rounded'
export const defaultSize = 24
