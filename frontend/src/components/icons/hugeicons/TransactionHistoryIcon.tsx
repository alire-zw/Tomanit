
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function TransactionHistoryIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M15.489 1.40314C14.3498 1.24997 12.8942 1.24998 11.0564 1.25C9.21867 1.24998 7.65019 1.24997 6.51098 1.40314C5.33856 1.56076 4.38961 1.89288 3.64124 2.64124C2.89288 3.38961 2.56076 4.33856 2.40314 5.51098C2.24997 6.65019 2.24998 8.10582 2.25 9.94357V14.0564C2.24998 15.8942 2.24997 17.3498 2.40314 18.489C2.56076 19.6614 2.89288 20.6104 3.64124 21.3588C4.38961 22.1071 5.33856 22.4392 6.51098 22.5969C7.65019 22.75 9.21865 22.75 11.0564 22.75C11.6273 22.75 12.1614 22.75 12.6606 22.7454C11.0474 21.5626 10 19.6536 10 17.5C10 13.9101 12.9101 11 16.5 11C17.6839 11 18.7939 11.3165 19.75 11.8696V9.94359C19.75 8.10585 19.75 6.65018 19.5969 5.51098C19.4392 4.33856 19.1071 3.38961 18.3588 2.64124C17.6104 1.89288 16.6614 1.56076 15.489 1.40314Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M6.25 7C6.25 6.58579 6.58579 6.25 7 6.25H15C15.4142 6.25 15.75 6.58579 15.75 7C15.75 7.41421 15.4142 7.75 15 7.75H7C6.58579 7.75 6.25 7.41421 6.25 7ZM6.25 11C6.25 10.5858 6.58579 10.25 7 10.25H11.5C11.9142 10.25 12.25 10.5858 12.25 11C12.25 11.4142 11.9142 11.75 11.5 11.75H7C6.58579 11.75 6.25 11.4142 6.25 11Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M16.5 12.25C13.6005 12.25 11.25 14.6005 11.25 17.5C11.25 20.3995 13.6005 22.75 16.5 22.75C19.3995 22.75 21.75 20.3995 21.75 17.5C21.75 14.6005 19.3995 12.25 16.5 12.25ZM17.25 15.5C17.25 15.0858 16.9142 14.75 16.5 14.75C16.0858 14.75 15.75 15.0858 15.75 15.5V17.95C15.75 18.2646 15.9464 18.5458 16.2418 18.6542L17.7418 19.2042C18.1307 19.3468 18.5616 19.1471 18.7042 18.7582C18.8468 18.3693 18.6471 17.9384 18.2582 17.7958L17.25 17.4262V15.5Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M19 10.5V9.99995C19 6.22876 18.9999 4.34311 17.8284 3.17154C16.6568 2 14.7712 2 11 2C7.22889 2 5.34326 2.00006 4.17169 3.17159C3.00015 4.34315 3.00013 6.22872 3.0001 9.99988L3.00006 14.5C3.00003 17.7874 3.00002 19.4312 3.90794 20.5375C4.07418 20.7401 4.25992 20.9258 4.46249 21.0921C5.56883 22 7.21255 22 10.5 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M7 7H15M7 11H11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M18 18.5L16.5 17.95V15.5M12 17.5C12 19.9853 14.0147 22 16.5 22C18.9853 22 21 19.9853 21 17.5C21 15.0147 18.9853 13 16.5 13C14.0147 13 12 15.0147 12 17.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
