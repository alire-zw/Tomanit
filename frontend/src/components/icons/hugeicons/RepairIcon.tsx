
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function RepairIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M14.4948 3.49476C15.4701 2.51949 16.802 2.1178 18.0685 2.28797C18.3512 2.32595 18.5879 2.52097 18.6792 2.79116C18.7705 3.06135 18.7007 3.35995 18.499 3.56162L17 5.06066V7H18.9393L20.4383 5.50096C20.64 5.29929 20.9386 5.22946 21.2088 5.32078C21.479 5.41209 21.674 5.64875 21.712 5.93142C21.8822 7.19792 21.4805 8.5299 20.5052 9.50516C19.404 10.6063 17.8499 10.976 16.4451 10.6175L10.6175 16.4451C10.9761 17.8499 10.6064 19.404 9.5052 20.5052C8.52994 21.4804 7.19796 21.8821 5.93146 21.7119C5.64879 21.674 5.41213 21.479 5.32081 21.2088C5.2295 20.9386 5.29933 20.64 5.501 20.4383L7.00004 18.9393V16.9999H5.0607L3.56166 18.499C3.35999 18.7006 3.06139 18.7705 2.7912 18.6791C2.52101 18.5878 2.32599 18.3512 2.28801 18.0685C2.11784 16.802 2.51953 15.47 3.4948 14.4948C4.59677 13.3928 6.15236 13.0233 7.55802 13.3832L13.3833 7.55798C13.0234 6.15232 13.3928 4.59673 14.4948 3.49476Z" fill={color}/>
<path d="M11.1778 9.7635L7.48753 6.07324L8.03043 5.53035C8.2009 5.35988 8.27903 5.11785 8.24041 4.87988C8.2018 4.64191 8.05114 4.43702 7.83551 4.3292L4.83551 2.8292C4.54677 2.68483 4.19804 2.74142 3.96977 2.96969L2.96977 3.96969C2.7415 4.19796 2.68491 4.54669 2.82928 4.83543L4.32928 7.83543C4.43709 8.05106 4.64199 8.20172 4.87996 8.24034C5.11793 8.27895 5.35996 8.20082 5.53043 8.03035L6.07332 7.48746L9.76358 11.1777L11.1778 9.7635Z" fill={color}/>
<path d="M11.6504 15.4132L16.8717 20.6344C17.6924 21.4551 19.023 21.4551 19.8437 20.6344L20.6354 19.8427C21.4561 19.022 21.4561 17.6914 20.6354 16.8707L15.4142 11.6494L11.6504 15.4132Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M11 11L6 6M7.5 5L5 7.5L3.5 4.5L4.5 3.5L7.5 5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
<path d="M19.9749 8.97487C20.9858 7.96391 21.2491 6.48836 20.7645 5.23548L19.3425 6.65748H17.3425V4.65748L18.7645 3.23548C17.5116 2.75095 16.0361 3.01416 15.0251 4.02513C14.0138 5.03647 13.7507 6.51274 14.236 7.76593L7.76593 14.236C6.51275 13.7507 5.03647 14.0138 4.02513 15.0251C3.01416 16.0361 2.75095 17.5116 3.23548 18.7645L4.65748 17.3425L6.65748 17.3425L6.65748 19.3425L5.23548 20.7645C6.48836 21.2491 7.96391 20.9858 8.97487 19.9749C9.98546 18.9643 10.2489 17.4895 9.76507 16.2369L16.2369 9.76507C17.4895 10.2489 18.9643 9.98546 19.9749 8.97487Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
<path opacity="0.4" d="M11.797 14.5L17.401 20.1041C17.9288 20.6319 18.7846 20.6319 19.3124 20.1041L20.1041 19.3124C20.632 18.7845 20.632 17.9288 20.1041 17.401L14.5001 11.7969" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
</svg>
)
}
