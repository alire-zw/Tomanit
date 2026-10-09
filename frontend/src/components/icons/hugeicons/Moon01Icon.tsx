
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function Moon01Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M12 1.25C13.4017 1.25 14.7422 1.51872 15.9717 2.00781L15.6309 2.36426C14.7831 3.14027 14.25 4.25846 14.25 5.5C14.25 7.84721 16.1528 9.75 18.5 9.75C19.73 9.75 20.8392 9.2266 21.6143 8.39258L22.0098 8.07227C22.4878 9.28973 22.75 10.615 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 6.06294 6.06294 1.25 12 1.25ZM17.3887 2.69629C19.0331 3.65072 20.4013 5.02848 21.3438 6.68066L20.5811 7.29883L20.542 7.3418C20.0377 7.90035 19.3101 8.25 18.5 8.25C16.9812 8.25 15.75 7.01878 15.75 5.5C15.75 4.68995 16.0997 3.96233 16.6582 3.45801L16.6787 3.43945L17.3887 2.69629Z" fill={color}/>
<path d="M14 13.25C15.5188 13.25 16.75 14.4812 16.75 16C16.75 17.5188 15.5188 18.75 14 18.75C12.4812 18.75 11.25 17.5188 11.25 16C11.25 14.4812 12.4812 13.25 14 13.25ZM14 14.75C13.3096 14.75 12.75 15.3096 12.75 16C12.75 16.6904 13.3096 17.25 14 17.25C14.6904 17.25 15.25 16.6904 15.25 16C15.25 15.3096 14.6904 14.75 14 14.75ZM7.00684 13C7.5589 13.0003 8.00684 13.4479 8.00684 14C8.00684 14.5521 7.5589 14.9997 7.00684 15H7C6.44772 15 6 14.5523 6 14C6 13.4477 6.44772 13 7 13H7.00684ZM10.0068 7C10.5589 7.00026 11.0068 7.44788 11.0068 8C11.0068 8.55212 10.5589 8.99974 10.0068 9H10C9.44772 9 9 8.55228 9 8C9 7.44772 9.44772 7 10 7H10.0068ZM17.3887 2.69531C19.0331 3.64977 20.4013 5.02745 21.3438 6.67969L20.5811 7.29785L20.542 7.34082C20.0377 7.89937 19.3101 8.24902 18.5 8.24902C16.9813 8.24902 15.7501 7.01774 15.75 5.49902C15.75 4.68896 16.0997 3.96136 16.6582 3.45703L16.6787 3.43848L17.3887 2.69531Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M21.0985 7.84477C20.458 8.55417 19.5311 9 18.5 9C16.567 9 15 7.433 15 5.5C15 4.46895 15.4458 3.54203 16.1552 2.90149M16.1552 2.90149C18.3384 3.90018 20.0998 5.66155 21.0985 7.84477C21.6774 9.11025 22 10.5174 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C13.4826 2 14.8898 2.32262 16.1552 2.90149Z" stroke={color} strokeWidth={strokeWidth}/>
<path opacity="0.4" d="M16 16C16 17.1046 15.1046 18 14 18C12.8954 18 12 17.1046 12 16C12 14.8954 12.8954 14 14 14C15.1046 14 16 14.8954 16 16Z" stroke={color} strokeWidth={strokeWidth}/>
<path opacity="0.4" d="M7.13086 14H7.00586M7.25586 14C7.25586 14.1381 7.14393 14.25 7.00586 14.25C6.86779 14.25 6.75586 14.1381 6.75586 14C6.75586 13.8619 6.86779 13.75 7.00586 13.75C7.14393 13.75 7.25586 13.8619 7.25586 14Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M10.1309 8H10.0059M10.2559 8C10.2559 8.13807 10.1439 8.25 10.0059 8.25C9.86779 8.25 9.75586 8.13807 9.75586 8C9.75586 7.86193 9.86779 7.75 10.0059 7.75C10.1439 7.75 10.2559 7.86193 10.2559 8Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
