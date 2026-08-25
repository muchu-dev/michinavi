"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { primaryNavigation } from "@/config/navigation";

type IconStyle = CSSProperties & { "--nav-icon": string };

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="sticky bottom-0 z-[1000] border-t border-outline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="grid h-[4.75rem] grid-cols-4">
        {primaryNavigation.map((item) => {
          const isCurrent = isCurrentPath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className="group flex h-full min-h-11 flex-col items-center justify-center gap-1 px-1 text-xs font-bold text-muted transition-colors hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-brand aria-[current=page]:text-brand"
              >
                <span
                  aria-hidden="true"
                  className="nav-icon h-6 w-7 bg-current"
                  style={
                    {
                      "--nav-icon": `url("${item.iconSrc}")`,
                    } as IconStyle
                  }
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
