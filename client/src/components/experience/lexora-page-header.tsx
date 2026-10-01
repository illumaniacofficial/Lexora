import type { ReactNode } from "react";

interface LexoraPageHeaderProps {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function LexoraPageHeader({ kicker, title, description, actions }: LexoraPageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-3xl">
        {kicker ? <p className="lexora-kicker mb-3">{kicker}</p> : null}
        <h1 className="lexora-display text-3xl font-semibold leading-[1.02] text-[#EFE5D9] md:text-[2.75rem]">{title}</h1>
        {description ? <div className="mt-2 max-w-2xl text-sm leading-6 text-[#BCAF9F]/65">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
