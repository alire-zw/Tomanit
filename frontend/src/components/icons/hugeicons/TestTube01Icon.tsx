
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function TestTube01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M18.0191 13.8673L18.019 13.8672L17.2036 12.572C16.7685 13.1271 15.6412 14.1732 14.3545 14.1732C13.9788 14.1732 13.2164 14.1732 12.1494 13.6751C11.4024 13.2221 10.6373 12.7698 9.92676 12.5042C9.7137 12.4246 9.48917 12.358 9.25977 12.3119C8.80557 12.1933 7.81024 12.0813 6.91356 12.3853L5.99511 13.8442C4.99267 15.4359 4.18022 16.7259 3.71808 17.7768C3.24721 18.8477 3.0123 19.9513 3.59308 20.9917C4.1714 22.0272 5.22996 22.411 6.38897 22.5815C7.53169 22.7495 9.06668 22.7495 10.9648 22.7495H13.0342C14.9325 22.7495 16.4678 22.7495 17.6107 22.5815C18.7697 22.411 19.8282 22.0272 20.4066 20.9917C20.9873 19.9513 20.7534 18.8477 20.2825 17.7768C19.8226 16.731 19.015 15.4486 18.0191 13.8673Z" fill={color}/>
<path d="M15 18.0004C15.5523 18.0004 16 18.4481 16 19.0004C16 19.5527 15.5523 20.0004 15 20.0004C14.4477 20.0004 14 19.5527 14 19.0004C14 18.4481 14.4477 18.0004 15 18.0004Z" fill={color}/>
<path d="M10 16.0004C10.5523 16.0004 11 16.4481 11 17.0004C11 17.5527 10.5523 18.0004 10 18.0004C9.44772 18.0004 9 17.5527 9 17.0004C9 16.4481 9.44771 16.0004 10 16.0004Z" fill={color}/>
<path d="M16.8604 2.22791C16.8604 1.68829 16.4254 1.25056 15.8887 1.25037H8.11133C7.57467 1.25066 7.13867 1.68835 7.13867 2.22791C7.13882 2.76733 7.57476 3.20417 8.11133 3.20447H8.56543V8.6449C8.56543 9.39501 8.55673 9.58057 8.50879 9.74646C8.46064 9.91271 8.368 10.0758 7.96777 10.7113L6.91406 12.3842C7.69853 12.1184 8.55858 12.1722 9.06543 12.2689L9.25977 12.3119L9.61133 11.7562C9.95393 11.2122 10.2333 10.784 10.376 10.2904C10.4831 9.91973 10.5056 9.53942 10.5098 9.10193V3.20349H13.4893V8.64392C13.4893 9.28523 13.4803 9.7963 13.623 10.2904C13.7657 10.784 14.0461 11.2122 14.3887 11.7562L15.8047 13.7582C16.4404 13.4042 16.9434 12.9017 17.2021 12.5717L16.0312 10.7113C15.631 10.0757 15.5384 9.91277 15.4902 9.74646C15.4423 9.58061 15.4336 9.39479 15.4336 8.6449V3.20447H15.8887C16.4253 3.20428 16.8602 2.7674 16.8604 2.22791Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M16.2187 13.0044L15.9921 13.6151C15.5219 14.65 14.1115 15.7439 11.7609 14.3182C10.2471 13.4001 8.93663 12.6631 7.9997 13.16L7.21891 13.5412" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M15.125 19H15M15.25 19C15.25 19.1381 15.1381 19.25 15 19.25C14.8619 19.25 14.75 19.1381 14.75 19C14.75 18.8619 14.8619 18.75 15 18.75C15.1381 18.75 15.25 18.8619 15.25 19Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M10.125 17H10M10.25 17C10.25 17.1381 10.1381 17.25 10 17.25C9.86193 17.25 9.75 17.1381 9.75 17C9.75 16.8619 9.86193 16.75 10 16.75C10.1381 16.75 10.25 16.8619 10.25 17Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M8 2H16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M14.5323 2V8.56602C14.5323 9.27829 14.5323 9.63442 14.6304 9.97222C14.7285 10.31 14.9197 10.612 15.3021 11.216L17.2861 14.35C19.4275 17.7326 20.4982 19.4238 19.7751 20.7119C19.0519 22 17.0317 22 12.9914 22H11.0086C6.96825 22 4.94807 22 4.22495 20.7119C3.50182 19.4238 4.57251 17.7326 6.71389 14.35L8.69792 11.216C9.08029 10.612 9.27148 10.31 9.36961 9.97222C9.46773 9.63442 9.46773 9.27829 9.46773 8.56602V2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
