
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function Copy01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path opacity="0.4" d="M22.25 14.5C22.25 16.1287 22.2517 17.4257 22.1152 18.4404C21.9759 19.4767 21.68 20.3298 21.0049 21.0049C20.3298 21.68 19.4767 21.9759 18.4404 22.1152C17.4257 22.2517 16.1287 22.25 14.5 22.25C12.8713 22.25 11.5743 22.2517 10.5596 22.1152C9.52332 21.9759 8.67025 21.68 7.99512 21.0049C7.31999 20.3298 7.02409 19.4767 6.88477 18.4404C6.74835 17.4257 6.75 16.1287 6.75 14.5C6.75 12.8713 6.74835 11.5743 6.88477 10.5596C7.02409 9.52332 7.31999 8.67025 7.99512 7.99512C8.67025 7.31999 9.52332 7.02409 10.5596 6.88477C11.5743 6.74835 12.8713 6.75 14.5 6.75C16.1287 6.75 17.4257 6.74835 18.4404 6.88477C19.4767 7.02409 20.3298 7.31999 21.0049 7.99512C21.68 8.67025 21.9759 9.52332 22.1152 10.5596C22.2517 11.5743 22.25 12.8713 22.25 14.5Z" fill={color}/>
<path d="M9.5 1.75C11.1287 1.75 12.4257 1.74835 13.4404 1.88477C14.4767 2.02409 15.3298 2.31999 16.0049 2.99512C16.6176 3.60786 16.9159 4.36754 17.0703 5.27734C16.2852 5.24868 15.4214 5.25 14.5 5.25C12.9131 5.25 11.4971 5.24547 10.3594 5.39844C9.15677 5.56017 7.93469 5.93445 6.93457 6.93457C5.93445 7.93469 5.56017 9.15677 5.39844 10.3594C5.24547 11.4971 5.25 12.9131 5.25 14.5C5.25 15.4214 5.24868 16.2852 5.27734 17.0703C4.36754 16.9159 3.60786 16.6176 2.99512 16.0049C2.31999 15.3298 2.02409 14.4767 1.88477 13.4404C1.74835 12.4257 1.75 11.1287 1.75 9.5C1.75 7.87129 1.74835 6.57426 1.88477 5.55957C2.02409 4.52332 2.31999 3.67025 2.99512 2.99512C3.67025 2.31999 4.52332 2.02409 5.55957 1.88477C6.57426 1.74835 7.87129 1.75 9.5 1.75Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
<path d="M7.5 14.5C7.5 11.2002 7.5 9.55025 8.52513 8.52513C9.55025 7.5 11.2002 7.5 14.5 7.5C17.7998 7.5 19.4497 7.5 20.4749 8.52513C21.5 9.55025 21.5 11.2002 21.5 14.5C21.5 17.7998 21.5 19.4497 20.4749 20.4749C19.4497 21.5 17.7998 21.5 14.5 21.5C11.2002 21.5 9.55025 21.5 8.52513 20.4749C7.5 19.4497 7.5 17.7998 7.5 14.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M7.5 16.5C6.10355 16.5 5.40533 16.5 4.84402 16.3036C3.83866 15.9518 3.0482 15.1613 2.69641 14.156C2.5 13.5947 2.5 12.8964 2.5 11.5V9.5C2.5 6.20017 2.5 4.55025 3.52513 3.52513C4.55025 2.5 6.20017 2.5 9.5 2.5H11.5C12.8964 2.5 13.5947 2.5 14.156 2.69641C15.1613 3.0482 15.9518 3.83866 16.3036 4.84402C16.5 5.40533 16.5 6.10355 16.5 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
