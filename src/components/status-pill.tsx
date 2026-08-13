import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Estado é sempre cor + rótulo: quem não distingue a cor lê o texto.
const TONE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg [&>i]:bg-ok-dot",
  bad: "bg-bad-bg text-bad-fg [&>i]:bg-bad-dot",
  warn: "bg-warn-bg text-warn-fg [&>i]:bg-warn-dot",
  mute: "bg-mute-bg text-mute-fg [&>i]:bg-mute-dot",
  idle: "bg-idle-bg text-idle-fg [&>i]:bg-idle-dot",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold",
        TONE[tone],
        className,
      )}
    >
      <i className="size-1.5 rounded-full" />
      {children}
    </span>
  );
}
