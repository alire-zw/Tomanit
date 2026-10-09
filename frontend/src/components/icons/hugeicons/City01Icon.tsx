
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function City01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7045 1.30089C14.0177 1.37252 14.3416 1.51629 14.652 1.67474L19.0352 3.91276C19.5375 4.16923 19.9809 4.39555 20.3314 4.62329C20.7117 4.87043 21.0525 5.16167 21.3068 5.58189C21.5604 6.00084 21.6617 6.43862 21.7076 6.89138C21.7501 7.31093 21.75 7.81479 21.75 8.3897V8.38976L21.75 21.25C21.75 21.8023 21.3023 22.25 20.75 22.25C20.1977 22.25 19.75 21.8023 19.75 21.25V8.43564C19.75 7.80138 19.7488 7.39969 19.7178 7.09285C19.6889 6.80809 19.6409 6.69202 19.5958 6.61744C19.5514 6.54411 19.4739 6.45126 19.2417 6.30036C18.9892 6.13632 18.6404 5.95684 18.0841 5.67278L13.75 3.45984L13.75 3.47873V7.25H11.75V3.47873C11.75 3.13437 11.7674 2.78533 11.8391 2.47804C11.9087 2.18024 12.0692 1.74955 12.4951 1.47393C12.9295 1.19279 13.3947 1.23002 13.7045 1.30089ZM6.25 13L6.25 11H4.25C4.02152 11 3.76956 11.0106 3.53015 11.0632C3.27942 11.1183 2.98317 11.2321 2.73264 11.4826C2.48211 11.7332 2.36828 12.0294 2.3132 12.2802C2.2606 12.5196 2.25 12.7715 2.25 13L2.25 21C2.25 21.5523 2.69772 22 3.25 22C3.80228 22 4.25 21.5523 4.25 21L4.25 13H6.25Z" fill={color}/>
<path opacity="0.4" d="M17.75 20.15V11C17.75 10.3633 17.7178 9.80098 17.6128 9.32323C17.506 8.83699 17.3139 8.39172 16.9611 8.03892C16.6083 7.68612 16.163 7.49401 15.6768 7.38719C15.199 7.28223 14.6367 7.25 14 7.25H10C9.36327 7.25 8.80098 7.28223 8.32323 7.38719C7.83699 7.49401 7.39172 7.68612 7.03892 8.03892C6.68612 8.39172 6.49401 8.83699 6.38719 9.32323C6.28223 9.80099 6.25 10.3633 6.25 11V20.15V21.5H17.75V20.15Z" fill={color}/>
<path d="M2 20.75C1.44772 20.75 1 21.1977 1 21.75C1 22.3023 1.44772 22.75 2 22.75H22C22.5523 22.75 23 22.3023 23 21.75C23 21.1977 22.5523 20.75 22 20.75H2Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M10.25 11C10.25 10.5858 10.5858 10.25 11 10.25L13 10.25C13.4142 10.25 13.75 10.5858 13.75 11C13.75 11.4142 13.4142 11.75 13 11.75H11C10.5858 11.75 10.25 11.4142 10.25 11ZM10.25 14C10.25 13.5858 10.5858 13.25 11 13.25H13C13.4142 13.25 13.75 13.5858 13.75 14C13.75 14.4142 13.4142 14.75 13 14.75H11C10.5858 14.75 10.25 14.4142 10.25 14ZM10.25 17C10.25 16.5858 10.5858 16.25 11 16.25H13C13.4142 16.25 13.75 16.5858 13.75 17C13.75 17.4142 13.4142 17.75 13 17.75H11C10.5858 17.75 10.25 17.4142 10.25 17Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M14 8H10C7.518 8 7 8.518 7 11V22H17V11C17 8.518 16.482 8 14 8Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
<path d="M11 12L13 12M11 15H13M11 18H13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M21 22V8.18564C21 6.95735 21 6.3432 20.7013 5.84966C20.4026 5.35612 19.8647 5.08147 18.7889 4.53216L14.4472 2.31536C13.2868 1.72284 13 1.93166 13 3.22873V7.7035" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M3 22V13C3 12.1727 3.17267 12 4 12H7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M22 22H2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
