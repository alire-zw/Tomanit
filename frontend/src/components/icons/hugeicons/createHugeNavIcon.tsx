import type { ComponentType } from "react";
import type { HugeIconProps, Variant } from "./constants";

type NavIconProps = {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
};

function toSize(width: number | string | undefined, fallback: number) {
  if (typeof width === "number") return width;
  const n = Number(width);
  return Number.isFinite(n) ? n : fallback;
}

export function createHugeNavIcon(
  Icon: ComponentType<HugeIconProps>,
  variant: Variant,
  fallbackSize = 22,
) {
  return function HugeNavIcon({
    width = fallbackSize,
    height = fallbackSize,
    color = "currentColor",
    className,
  }: NavIconProps) {
    const size = toSize(width, fallbackSize);
    return (
      <Icon
        variant={variant}
        size={size}
        color={color}
        className={className}
        width={width}
        height={height}
      />
    );
  };
}
