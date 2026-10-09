import type { ComponentType } from "react";
import AdminActiveIcon from "./icons/AdminActiveIcon";
import AdminIcon from "./icons/AdminIcon";
import ContactActiveIcon from "./icons/ContactActiveIcon";
import ContactIcon from "./icons/ContactIcon";
import MyShopActiveIcon from "./icons/MyShopActiveIcon";
import MyShopIcon from "./icons/MyShopIcon";
import NavWalletActiveIcon from "./icons/NavWalletActiveIcon";
import NavWalletIcon from "./icons/NavWalletIcon";
import UserActiveIcon from "./icons/UserActiveIcon";
import UserIcon from "./icons/UserIcon";

type IconProps = {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
};

export type NavItem = {
  id: string;
  labelKey: string;
  path: string;
  icon: ComponentType<IconProps>;
  activeIcon: ComponentType<IconProps>;
};

export const iconSize = { width: 22, height: 22 };

export const navItems: NavItem[] = [
  {
    id: "wallet",
    labelKey: "nav.wallet",
    path: "/",
    icon: NavWalletIcon,
    activeIcon: NavWalletActiveIcon,
  },
  {
    id: "my-shop",
    labelKey: "nav.myShop",
    path: "/shop",
    icon: MyShopIcon,
    activeIcon: MyShopActiveIcon,
  },
  {
    id: "support",
    labelKey: "nav.support",
    path: "/support",
    icon: ContactIcon,
    activeIcon: ContactActiveIcon,
  },
  {
    id: "profile",
    labelKey: "nav.profile",
    path: "/profile",
    icon: UserIcon,
    activeIcon: UserActiveIcon,
  },
];

export const adminNavItem: NavItem = {
  id: "admin",
  labelKey: "nav.admin",
  path: "/admin",
  icon: AdminIcon,
  activeIcon: AdminActiveIcon,
};
