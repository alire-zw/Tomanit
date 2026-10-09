
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function User02Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M17.25 7C17.25 9.62335 15.1234 11.75 12.5 11.75C9.87666 11.75 7.75001 9.62335 7.75001 7C7.75001 4.37665 9.87666 2.25 12.5 2.25C15.1234 2.25 17.25 4.37665 17.25 7Z" fill={color}/>
<path opacity="0.4" d="M21.25 19C21.25 20.5188 20.0188 21.75 18.5 21.75H6.50001C4.98122 21.75 3.75001 20.5188 3.75001 19C3.75001 17.4341 4.68563 15.9764 6.20216 14.9424C7.72501 13.9041 9.8802 13.25 12.5 13.25C15.1198 13.25 17.275 13.9041 18.7979 14.9424C20.3144 15.9764 21.25 17.4341 21.25 19Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<circle cx="12" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M12 14C7 14 4 16.5 4 19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19C20 16.5 17 14 12 14Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
