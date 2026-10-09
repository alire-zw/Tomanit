
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function CoinsSwapIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M1.25 16C1.25 12.2721 4.27208 9.25 8 9.25C11.7279 9.25 14.75 12.2721 14.75 16C14.75 19.7279 11.7279 22.75 8 22.75C4.27208 22.75 1.25 19.7279 1.25 16Z" fill={color}/>
<path opacity="0.4" d="M16 1.25C19.7279 1.25 22.75 4.27208 22.75 8C22.75 11.4976 20.0899 14.3738 16.6825 14.7159C16.447 14.7396 16.3293 14.7514 16.2368 14.6843C16.1444 14.6172 16.1161 14.4879 16.0596 14.2294C15.374 11.0943 12.9057 8.62605 9.77063 7.94046C9.5121 7.88392 9.38283 7.85565 9.31573 7.76318C9.24862 7.6707 9.26044 7.55298 9.28409 7.31753C9.62621 3.91012 12.5025 1.25 16 1.25Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M5.77448 4.24219L6.5663 5.19395C6.72824 5.38861 6.97748 5.48841 7.22902 5.45932C7.48056 5.43023 7.70044 5.27618 7.81368 5.0497L8.67082 3.33541C8.78707 3.10292 8.77464 2.82681 8.63799 2.6057C8.50133 2.38459 8.25993 2.25 8 2.25C7.21245 2.25 6.45502 2.38478 5.75052 2.63328C3.12763 3.55843 1.25 6.05696 1.25 9C1.25 9.41421 1.58579 9.75 2 9.75C2.41421 9.75 2.75 9.41421 2.75 9C2.75 6.89355 3.98604 5.07881 5.77448 4.24219Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M18.2255 19.7578L17.4337 18.806C17.2718 18.6114 17.0225 18.5116 16.771 18.5407C16.5194 18.5698 16.2996 18.7238 16.1863 18.9503L15.3292 20.6646C15.2129 20.8971 15.2254 21.1732 15.362 21.3943C15.4987 21.6154 15.7401 21.75 16 21.75C16.7875 21.75 17.545 21.6152 18.2495 21.3667C20.8724 20.4416 22.75 17.943 22.75 15C22.75 14.5858 22.4142 14.25 22 14.25C21.5858 14.25 21.25 14.5858 21.25 15C21.25 17.1064 20.014 18.9212 18.2255 19.7578Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M10 7.0268C10.483 4.17323 12.9665 2 15.9575 2C19.2947 2 22 4.70532 22 8.0425C22 11.0335 19.8268 13.517 16.9732 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M8 22C11.3137 22 14 19.3137 14 16C14 12.6863 11.3137 10 8 10C4.68629 10 2 12.6863 2 16C2 19.3137 4.68629 22 8 22Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M2 9C2 5.68286 4.68286 3 8 3L7.14286 4.71429" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M22 15C22 18.3171 19.3171 21 16 21L16.8571 19.2857" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
