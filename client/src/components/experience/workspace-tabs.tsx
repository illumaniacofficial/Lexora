import type { ReactNode } from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface WorkspaceTabsProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceTabs({ children, className }: WorkspaceTabsProps) {
  return (
    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]" data-testid="project-workspace-tab-scroll">
      <TabsList
        className={cn(
          "h-11 min-w-max w-max flex-nowrap rounded-xl border border-[#C0A06B]/10 bg-[#131015]/86 p-1",
          className,
        )}
      >
        {children}
      </TabsList>
    </div>
  );
}
