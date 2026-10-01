import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen } from "lucide-react";

interface EmptyCreativeStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

export function EmptyCreativeState({ title, description, action, icon: Icon = BookOpen }: EmptyCreativeStateProps) {
  return (
    <div className="lexora-editorial-surface flex min-h-64 flex-col items-center justify-center rounded-[28px] px-6 py-12 text-center">
      <div className="lexora-cover-placeholder flex h-16 w-12 items-center justify-center rounded-lg border border-[#C0A06B]/10 shadow-[0_18px_40px_-24px_rgba(0,0,0,.9)]">
        <Icon className="relative z-10 h-5 w-5 text-[#C0A06B]/65" />
      </div>
      <h3 className="lexora-display mt-5 text-xl font-semibold text-[#EFE5D9]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#BCAF9F]/55">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
