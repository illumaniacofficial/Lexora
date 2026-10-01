import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CreativeMetricProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
}

export function CreativeMetric({ label, value, detail, icon: Icon }: CreativeMetricProps) {
  return (
    <div className="border-l border-[#C0A06B]/20 pl-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#C0A06B]/65" /> : null}
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#BCAF9F]/45">{label}</p>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#EFE5D9]">{value}</div>
      {detail ? <div className="mt-1 text-[11px] text-[#BCAF9F]/45">{detail}</div> : null}
    </div>
  );
}
