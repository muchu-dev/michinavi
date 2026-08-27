export type PrimaryNavigationItem = {
  href: "/" | "/posts" | "/evacuation" | "/family";
  label: "地図" | "投稿" | "避難計画" | "家族";
  iconSrc: string;
};

export const primaryNavigation = [
  { href: "/", label: "地図", iconSrc: "/icons/nav-map.svg" },
  { href: "/posts", label: "投稿", iconSrc: "/icons/nav-post.svg" },
  {
    href: "/evacuation",
    label: "避難計画",
    iconSrc: "/icons/nav-evacuation.svg",
  },
  { href: "/family", label: "家族", iconSrc: "/icons/nav-family.svg" },
] as const satisfies readonly PrimaryNavigationItem[];
