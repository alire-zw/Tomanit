interface LinkIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

/** Hugeicons-style stroke link */
export default function LinkIcon({
  width = 18,
  height = 18,
  color = "currentColor",
  className,
}: LinkIconProps) {
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
        d="M9.5 14.5L14.5 9.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15.006 17.548L14.087 18.534C12.039 20.743 8.718 20.743 6.67 18.534C4.622 16.325 4.622 12.743 6.67 10.534L7.589 9.548"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        opacity="0.4"
        d="M16.411 14.452L17.33 13.466C19.378 11.257 19.378 7.675 17.33 5.466C15.282 3.257 11.961 3.257 9.913 5.466L8.994 6.452"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
