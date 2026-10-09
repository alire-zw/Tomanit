interface EyeIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

/** Hugeicons-style stroke eye / view */
export default function EyeIcon({
  width = 18,
  height = 18,
  color = "currentColor",
  className,
}: EyeIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M2.42 12.713C2.284 12.498 2.216 12.39 2.178 12.23C2.15 12.11 2.15 11.89 2.178 11.77C2.216 11.61 2.284 11.502 2.42 11.287C3.545 9.505 6.895 5.25 12 5.25C17.105 5.25 20.455 9.505 21.58 11.287C21.716 11.502 21.784 11.61 21.822 11.77C21.85 11.89 21.85 12.11 21.822 12.23C21.784 12.39 21.716 12.498 21.58 12.713C20.455 14.495 17.105 18.75 12 18.75C6.895 18.75 3.545 14.495 2.42 12.713Z"
        stroke={color}
        strokeWidth="1.5"
      />
      <path
        opacity="0.4"
        d="M12 15C13.657 15 15 13.657 15 12C15 10.343 13.657 9 12 9C10.343 9 9 10.343 9 12C9 13.657 10.343 15 12 15Z"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
