import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EditorialSectionProps {
  title?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function EditorialSection({ title, eyebrow, action, children, className }: EditorialSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || eyebrow || action) ? (
        <div className="flex items-end justify-between gap-4">
          <div>
            {eyebrow ? <p className="lexora-kicker mb-1.5">{eyebrow}</p> : null}
            {title ? <h2 className="lexora-display text-xl font-semibold text-[#EFE5D9] md:text-2xl">{title}</h2> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
