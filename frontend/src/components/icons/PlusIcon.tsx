interface PlusIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

/** Hugeicons-style stroke add / plus */
export default function PlusIcon({
  width = 18,
  height = 18,
  color = "currentColor",
  className,
}: PlusIconProps) {
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
        d="M12 4.5V19.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.5 12H19.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
