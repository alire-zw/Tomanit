
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function Robot01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component =
    iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M19.7504 7.92146V7.8938V7.86334C19.7504 7.28971 19.7504 6.80779 19.721 6.41231C19.6905 6.00019 19.624 5.60679 19.4514 5.2275C19.1114 4.48026 18.5067 3.88209 17.7514 3.54574C17.368 3.37503 16.9703 3.30927 16.5537 3.27901C16.1539 3.24998 15.6667 3.24999 15.0868 3.25H15.0561H8.94464H8.91395C8.33404 3.24999 7.84685 3.24998 7.44705 3.27901C7.03045 3.30927 6.63277 3.37503 6.24936 3.54574C5.494 3.88209 4.88932 4.48026 4.54932 5.2275C4.37676 5.60679 4.31028 6.00019 4.27969 6.41231C4.25035 6.80781 4.25036 7.28977 4.25037 7.86343V7.8938V7.92138C4.25036 8.85667 4.25036 9.61104 4.29578 10.2232C4.34236 10.8508 4.44055 11.4047 4.67703 11.9246C5.16277 12.9923 6.02721 13.8474 7.10648 14.3279C7.63203 14.5619 8.19194 14.659 8.82639 14.7051C9.44517 14.75 10.2077 14.75 11.1532 14.75H11.1811H12.8196H12.8476C13.793 14.75 14.5556 14.75 15.1743 14.7051C15.8088 14.659 16.3687 14.5619 16.8943 14.3279C17.9735 13.8474 18.838 12.9923 19.3237 11.9246C19.5602 11.4047 19.6584 10.8508 19.705 10.2232C19.7504 9.61106 19.7504 8.85672 19.7504 7.92146Z" fill={color}/>
<path d="M9.35291 7.25488C9.85703 7.30621 10.2504 7.73232 10.2504 8.25C10.2504 8.80229 9.80265 9.25 9.25037 9.25C8.69808 9.25 8.25037 8.80228 8.25037 8.25C8.25037 7.69772 8.69808 7.25 9.25037 7.25L9.35291 7.25488Z" fill={color}/>
<path d="M14.8529 7.25488C15.357 7.30621 15.7504 7.73232 15.7504 8.25C15.7504 8.80229 15.3026 9.25 14.7504 9.25C14.1981 9.25 13.7504 8.80228 13.7504 8.25C13.7504 7.69772 14.1981 7.25 14.7504 7.25L14.8529 7.25488Z" fill={color}/>
<path d="M12.0004 1.25C12.5527 1.25 13.0004 1.69772 13.0004 2.25V3.25H11.0004V2.25C11.0004 1.69772 11.4481 1.25 12.0004 1.25Z" fill={color}/>
<path d="M16.4789 14.4824C19.0368 16.0096 20.7504 18.8044 20.7504 22C20.7504 22.4142 20.4146 22.75 20.0004 22.75H4.00037C3.58615 22.75 3.25037 22.4142 3.25037 22C3.25037 18.8047 4.96333 16.0097 7.52087 14.4824C7.92601 14.6079 8.35572 14.6709 8.82654 14.7051C9.4452 14.75 10.2076 14.75 11.1527 14.75H12.848C13.7932 14.75 14.5555 14.75 15.1742 14.7051C15.6447 14.6709 16.074 14.6077 16.4789 14.4824Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M12 4V2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M20 22C20 17.5817 16.4183 14 12 14C7.58172 14 4 17.5817 4 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M9.375 8.25H9.25M9.5 8.25C9.5 8.38807 9.38807 8.5 9.25 8.5C9.11193 8.5 9 8.38807 9 8.25C9 8.11193 9.11193 8 9.25 8C9.38807 8 9.5 8.11193 9.5 8.25Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M14.875 8.25H14.75M15 8.25C15 8.38807 14.8881 8.5 14.75 8.5C14.6119 8.5 14.5 8.38807 14.5 8.25C14.5 8.11193 14.6119 8 14.75 8C14.8881 8 15 8.11193 15 8.25Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M15.1538 4H8.84615C7.59095 4 6.96334 4 6.47397 4.22025C5.91693 4.47095 5.47095 4.91693 5.22025 5.47397C5 5.96334 5 6.59095 5 7.84615C5 9.85448 5 10.8586 5.3524 11.6417C5.75353 12.5329 6.46709 13.2465 7.35835 13.6476C8.14135 14 9.14552 14 11.1538 14H12.8462C14.8545 14 15.8586 14 16.6417 13.6476C17.5329 13.2465 18.2465 12.5329 18.6476 11.6417C19 10.8586 19 9.85448 19 7.84615C19 6.59095 19 5.96334 18.7797 5.47397C18.529 4.91693 18.0831 4.47095 17.526 4.22025C17.0367 4 16.4091 4 15.1538 4Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
