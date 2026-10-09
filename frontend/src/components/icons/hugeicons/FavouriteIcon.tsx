
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function FavouriteIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path opacity="0.4" d="M19.4189 15.6602C21.1899 13.624 22.75 11.153 22.75 8.69434C22.7499 5.45202 20.3484 2.75 17 2.75C15.4082 2.75 13.8662 3.26268 12 4.96484C10.1338 3.26268 8.59184 2.75 7 2.75C3.65156 2.75 1.25005 5.45202 1.25 8.69434C1.25 11.153 2.8101 13.624 4.58105 15.6602C6.37954 17.7279 8.5291 19.4969 9.96191 20.5684L10.1943 20.7285C11.3812 21.4741 12.8985 21.4204 14.0381 20.5684L14.6074 20.1348C16.0032 19.05 17.8453 17.4694 19.4189 15.6602Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path opacity="0.4" d="M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M12 6C10 4 8.5 3.5 7 3.5C4.10526 3.5 2 5.82563 2 8.69444C2 13.0348 7.58942 17.858 10.4107 19.9677C10.8854 20.3227 11.4427 20.5001 12 20.5001" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
