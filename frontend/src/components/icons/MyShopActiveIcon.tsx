import ShoppingBag02Icon from "./hugeicons/ShoppingBag02Icon";

type Props = {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
};

/** Active — Shopping Bag 02 bulk-rounded */
export default function MyShopActiveIcon({
  width = 22,
  height = 22,
  color = "currentColor",
  className,
}: Props) {
  const size = typeof width === "number" ? width : Number(width) || 22;
  return (
    <ShoppingBag02Icon
      variant="bulk-rounded"
      size={size}
      color={color}
      className={className}
      width={width}
      height={height}
    />
  );
}
