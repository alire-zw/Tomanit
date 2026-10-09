
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function ChartRoseIcon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M3.33203 11.686C3.33203 9.1648 5.735 7.22266 8.558 7.22266C8.9013 7.22266 9.17959 7.48331 9.17959 7.80484V11.686C9.17959 12.0076 8.9013 12.2682 8.558 12.2682H3.95362C3.61033 12.2682 3.33203 12.0076 3.33203 11.686Z" fill={color}/>
<path d="M4.30959 13.7695L4.36988 13.7695H8.52738C8.70047 13.7695 8.86647 13.8351 8.98886 13.9517C9.11125 14.0684 9.18001 14.2266 9.18001 14.3916L9.18001 20.1973C9.18001 20.5409 8.88782 20.8194 8.52738 20.8194C5.55833 20.8194 2.96218 19.3045 1.77913 17.0697L1.7523 17.0191C1.56136 16.6589 1.36536 16.2891 1.2882 15.9297C1.19287 15.4857 1.27496 15.0766 1.54563 14.6575C1.84535 14.1934 2.26481 13.9607 2.77066 13.8574C3.20147 13.7693 3.73302 13.7694 4.30959 13.7695Z" fill={color}/>
<path opacity="0.4" d="M10.6992 14.4161C10.6992 14.059 10.9881 13.7695 11.3445 13.7695H19.9483C20.3047 13.7695 20.5936 14.059 20.5936 14.4161C20.5936 18.2376 17.806 21.4069 14.068 22.4516L14.0168 22.4659C13.5512 22.5961 13.114 22.7184 12.7293 22.7459C12.2777 22.7781 11.8618 22.6855 11.4645 22.3832C11.0432 22.0627 10.8555 21.64 10.7727 21.1677C10.6991 20.7477 10.6992 20.2266 10.6992 19.6412L10.6992 19.5889V14.4161Z" fill={color}/>
<path d="M14.0878 1.48292L14.1393 1.49455C18.1071 2.39038 21.2926 5.1734 22.4067 8.78574L22.4231 8.83901L22.4231 8.83902C22.5673 9.30588 22.7041 9.74906 22.7399 10.1438C22.7823 10.6111 22.6898 11.0406 22.3841 11.4562C22.0581 11.8993 21.625 12.1001 21.1362 12.1887C20.7044 12.267 20.169 12.2669 19.5703 12.2669H19.5703L19.5155 12.2669H10.6992V4.51108L10.6992 4.45922C10.6992 3.85746 10.6991 3.32552 10.7705 2.89734C10.8501 2.42043 11.0304 1.98705 11.4459 1.65382C11.8423 1.33592 12.2678 1.23562 12.7276 1.25162C13.1255 1.26547 13.587 1.36976 14.0878 1.48292Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M9.77821 8C6.70996 8 4.22266 10.2386 4.22266 13H9.77821V8Z" stroke={color} strokeWidth={strokeWidth}/>
<path d="M2.69232 15.8912C3.91511 18.3147 6.62776 20 9.77778 20L9.77778 13H5C3.55493 13 2.8324 13 2.39309 13.7137C1.95377 14.4275 2.19995 14.9154 2.69232 15.8912Z" stroke={color} strokeWidth={strokeWidth}/>
<path opacity="0.4" d="M12.7413 21.5981C16.817 20.4613 19.7773 17.0418 19.7773 13H9.77734V19C9.77734 20.4624 9.77734 21.1936 10.3703 21.6438C10.9632 22.094 11.5559 21.9287 12.7413 21.5981Z" stroke={color} strokeWidth={strokeWidth}/>
<path d="M21.5533 10.0442C20.381 6.25325 17.0095 3.28684 12.7537 2.32846C11.5202 2.05069 10.9035 1.9118 10.3404 2.36217C9.77734 2.81253 9.77734 3.54169 9.77734 5V13H18.9996C20.4605 13 21.1909 13 21.6406 12.3903C22.0902 11.7806 21.9112 11.2018 21.5533 10.0442Z" stroke={color} strokeWidth={strokeWidth}/>
</svg>
)
}
