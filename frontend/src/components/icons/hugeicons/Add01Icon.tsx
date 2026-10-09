
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function Add01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M11.001 19.002V5.00003C11.001 4.44775 11.4487 4.00003 12.001 4.00003C12.5533 4.00003 13.001 4.44775 13.001 5.00003V19.002L12.9961 19.1045C12.9448 19.6087 12.5187 20.002 12.001 20.002C11.4833 20.002 11.0572 19.6087 11.0059 19.1045L11.001 19.002Z" fill={color}/>
<path opacity="0.4" d="M5 11.002L19.002 11.002C19.5542 11.002 20.002 11.4497 20.002 12.002C20.002 12.5543 19.5542 13.002 19.002 13.002L5 13.002L4.89746 12.9971C4.39332 12.9458 4 12.5197 4 12.002C4 11.4843 4.39332 11.0582 4.89746 11.0069L5 11.002Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M12.001 5.00003V19.002" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M19.002 12.002L4.99998 12.002" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
