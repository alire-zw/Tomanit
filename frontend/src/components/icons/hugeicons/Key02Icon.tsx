
import React from 'react'
import {type Variant, type HugeIconProps, defaultStrokeWidth, defaultVariant, defaultColor, defaultSize } from './constants'

const iconMap: Partial<Record<Variant, React.FC<HugeIconProps>>> = { 
  	'bulk-rounded': BulkRounded,
	'twotone-rounded': TwotoneRounded,
}

export default function Key02Icon({ variant, ...rest }: HugeIconProps) {
  const selectedVariant = variant || defaultVariant
  const Component = iconMap[selectedVariant as Variant] || iconMap[defaultVariant] || BulkRounded
  return <Component {...rest} />
}


function BulkRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path opacity="0.4" d="M16.7936 2.50301L16.8346 2.52812C17.6176 3.00659 18.5011 3.66927 19.4158 4.58398C20.3305 5.49869 20.9932 6.38223 21.4717 7.16514L21.4968 7.20622C21.7284 7.58497 21.9567 7.9583 22.0954 8.36889C22.2504 8.82756 22.2848 9.29409 22.216 9.87201C22.0676 11.1201 21.4102 11.7768 20.5103 12.6758C19.8951 13.2644 19.1256 14.0042 18.6761 14.3559C18.2074 14.7227 17.7467 14.9902 17.1984 15.1162C17.0848 15.1423 16.9701 15.1631 16.8546 15.1785C16.2969 15.2528 15.7717 15.1639 15.2041 14.9848C14.7636 14.8459 14.2617 14.6403 13.6714 14.3891L11.0312 17.0296C10.8906 17.1703 10.6998 17.2493 10.5008 17.2493H8.75085V18.9993C8.75085 19.4136 8.41506 19.7493 8.00085 19.7493H6.25021V21.5C6.25021 21.9142 5.91443 22.25 5.50021 22.25H2.50021C2.086 22.25 1.75021 21.9142 1.75021 21.5V18.5C1.75021 18.3011 1.82923 18.1103 1.96988 17.9697L9.6109 10.3284C9.3597 9.73809 9.15409 9.23617 9.01513 8.79564C8.83607 8.22797 8.74709 7.70276 8.82148 7.14505C8.83688 7.02964 8.85764 6.915 8.8837 6.80153C9.00964 6.25315 9.27717 5.79251 9.64396 5.3237C9.99563 4.87421 10.7354 4.10475 11.324 3.48945C12.2229 2.5896 12.8796 1.93223 14.1278 1.78375C14.7057 1.715 15.1722 1.7494 15.6309 1.90436C16.0415 2.04308 16.4148 2.27139 16.7936 2.50301Z" fill={color}/>
<path fillRule="evenodd" clipRule="evenodd" d="M17.5305 6.46967C17.8234 6.76256 17.8234 7.23744 17.5305 7.53033L16.5305 8.53033C16.2377 8.82322 15.7628 8.82322 15.4699 8.53033C15.177 8.23744 15.177 7.76256 15.4699 7.46967L16.4699 6.46967C16.7628 6.17678 17.2377 6.17678 17.5305 6.46967Z" fill={color}/>
</svg>
)
}

function TwotoneRounded({ size = defaultSize, color = defaultColor, strokeWidth = defaultStrokeWidth, className, ...rest }: HugeIconProps) {
  return (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"{...rest}>
<path d="M13.4998 13.5C15.1242 14.1962 15.9365 14.5443 16.7554 14.4351C16.8478 14.4227 16.9396 14.4061 17.0305 14.3852C17.8357 14.2003 18.4742 13.5894 19.7513 12.3676L19.9012 12.2242C20.8695 11.2559 21.3537 10.7717 21.4713 9.78342C21.5889 8.79514 21.3365 8.38218 20.8317 7.55626C20.3833 6.82247 19.7571 5.98593 18.8855 5.11433C18.0139 4.24272 17.1773 3.61654 16.4435 3.16808C15.6176 2.66332 15.2047 2.41094 14.2164 2.52851C13.2281 2.64609 12.7439 3.13027 11.7756 4.09863L11.6322 4.24843C10.4105 5.52557 9.7996 6.16413 9.61466 6.96941C9.59382 7.0602 9.57721 7.1519 9.56489 7.24423C9.45564 8.06322 9.80375 8.87548 10.5 10.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path d="M10.5002 10.499L2.50021 18.4997V21.4997H5.50021V19.4997H7.50021V17.4997H9.50021L13.5002 13.4997" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
<path opacity="0.4" d="M17.0002 7L16.0002 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
</svg>
)
}
