import { Link, useLocation } from "wouter";
import { BookOpen, FolderOpen, Home, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Library", href: "/library", icon: BookOpen },
  { label: "Create", href: "/projects/new", icon: Plus, primary: true },
  { label: "Projects", href: "/projects", icon: FolderOpen },
  { label: "More", href: "/settings", icon: MoreHorizontal },
] as const;

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C0A06B]/10 bg-[#0D0A0E]/96 px-2 pt-2 backdrop-blur-xl md:hidden pb-[max(.5rem,env(safe-area-inset-bottom))]"
      aria-label="Mobile workspace"
      data-testid="mobile-bottom-nav"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map((item) => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href}>
              <div
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors",
                  item.primary
                    ? "bg-[#7E3E51] text-[#FFF9F2]"
                    : active
                      ? "text-[#EFE5D9]"
                      : "text-[#BCAF9F]/42 hover:text-[#EFE5D9]"
                )}
                data-active={active}
              >
                <Icon className={cn("h-4 w-4", active && !item.primary ? "text-[#C0A06B]" : "")} />
                <span className="font-mono text-[8px] uppercase tracking-[.08em]">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
