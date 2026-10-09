
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function RefreshIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M12 3.20455C7.1424 3.20455 3.20455 7.1424 3.20455 12C3.20455 16.8576 7.1424 20.7955 12 20.7955C16.8576 20.7955 20.7955 16.8576 20.7955 12C20.7955 11.4603 21.233 11.0227 21.7727 11.0227C22.3125 11.0227 22.75 11.4603 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C14.1254 1.25 16.1072 1.86735 17.7751 2.93159L19 1.70668C19.173 1.43228 19.4788 1.25 19.8272 1.25C20.367 1.25 20.8045 1.68754 20.8045 2.22727V5.28828C20.8045 6.48198 19.3213 7.02646 18.548 6.12763C16.9364 4.33189 14.6005 3.20455 12 3.20455Z" fill={color}/>
<path d="M12 3.20455C7.1424 3.20455 3.20455 7.1424 3.20455 12C3.20455 13.6803 3.67571 15.2505 4.49314 16.5858L2.97639 17.845C1.88429 16.1625 1.25 14.1553 1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C14.1254 1.25 16.1072 1.86735 17.7751 2.93159L19 1.70668C19.173 1.43228 19.4788 1.25 19.8272 1.25C20.367 1.25 20.8045 1.68754 20.8045 2.22727V5.28828C20.8045 6.48198 19.3213 7.02646 18.548 6.12763C16.9364 4.33189 14.6005 3.20455 12 3.20455Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M20.0092 2V5.13219C20.0092 5.42605 19.6418 5.55908 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M20 2V5.13219C20 5.42605 19.6328 5.55908 19.4447 5.33333C17.6146 3.2875 14.955 2 11.9949 2C6.47485 2 2 6.47715 2 12C2 17.5228 6.47485 22 11.9949 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
