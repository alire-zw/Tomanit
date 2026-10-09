import ShoppingBag02Icon from "./hugeicons/ShoppingBag02Icon";

type Props = {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
};

/** Inactive — Shopping Bag 02 twotone-rounded */
export default function MyShopIcon({
  width = 22,
  height = 22,
  color = "currentColor",
  className,
}: Props) {
  const size = typeof width === "number" ? width : Number(width) || 22;
  return (
    <ShoppingBag02Icon
      variant="twotone-rounded"
      size={size}
      color={color}
      className={className}
      width={width}
      height={height}
    />
  );
}
