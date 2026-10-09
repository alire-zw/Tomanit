
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function UserIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path opacity="0.4" d="M12.0455 13.252L13.0397 13.3184C15.4998 13.4827 17.6636 14.7184 19.068 16.5645C19.4861 17.1141 19.9089 17.6565 20.111 18.2227C20.3457 18.8808 20.2773 19.5178 19.9303 20.2197C19.7505 20.5832 19.5158 20.8888 19.2067 21.126C18.8998 21.3614 18.5544 21.5024 18.193 21.5898C17.5106 21.7548 16.6446 21.75 15.6705 21.75H8.32092C7.34962 21.75 6.48614 21.755 5.8053 21.5908C5.44478 21.5039 5.10108 21.363 4.79455 21.1289C4.4858 20.8931 4.25038 20.5904 4.06994 20.2285C3.72085 19.5284 3.65155 18.8922 3.88342 18.2334C4.08308 17.6662 4.5033 17.1201 4.91955 16.5654C6.32394 14.6942 8.49712 13.41 10.9615 13.2891C11.2789 13.2735 11.615 13.2599 11.9752 13.25L12.0455 13.252Z" fill={color}/>
<path d="M16.7498 7C16.7498 9.62335 14.6231 11.75 11.9998 11.75C9.3764 11.75 7.24976 9.62335 7.24976 7C7.24976 4.37665 9.3764 2.25 11.9998 2.25C14.6231 2.25 16.7498 4.37665 16.7498 7Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path opacity="0.4" d="M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<circle cx="12" cy="6.99988" r="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
