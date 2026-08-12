"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ChartHelpDialogProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function ChartHelpDialog({ title, description, children }: ChartHelpDialogProps) {
  const triggerLabel = `Explain ${title}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="chart-help-dialog__trigger"
          variant="ghost"
          size="icon-sm"
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <CircleHelp />
        </Button>
      </DialogTrigger>
      <DialogContent className="chart-help-dialog__content max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="chart-help-dialog__header">
          <DialogTitle className="chart-help-dialog__title">{title}</DialogTitle>
          <DialogDescription className="chart-help-dialog__description">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children ? <div className="chart-help-dialog__body">{children}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
