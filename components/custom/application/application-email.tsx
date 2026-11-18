"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ApplicationEmail({ email }: { email: string }) {
  if (!email?.trim()) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate" title={email}>{email}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="이메일 주소 복사"
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await navigator.clipboard.writeText(email);
                toast.success("이메일 주소가 복사되었습니다.");
              } catch {
                toast.error("이메일 주소를 복사하지 못했습니다.");
              }
            }}
          >
            <Copy aria-hidden className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>이메일 주소 복사</TooltipContent>
      </Tooltip>
    </div>
  );
}
