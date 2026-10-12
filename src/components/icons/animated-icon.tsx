import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconAnimation = "bounce" | "wiggle" | "bell" | "spin" | "pop" | "nudge";

/**
 * Ikonka Lucide s jemnou animací při najetí myší (inspirováno itshover.com).
 * Animace se spouští, když je kurzor nad nejbližším rodičem s třídou `group`
 * (odkaz v navigaci, tlačítko, karta), a respektuje prefers-reduced-motion.
 */
export function AnimatedIcon({
  icon: Icon,
  animation = "bounce",
  className,
  ...props
}: LucideProps & { icon: LucideIcon; animation?: IconAnimation }) {
  return <Icon aria-hidden data-anim={animation} className={cn("anim-icon", className)} strokeWidth={1.9} {...props} />;
}
