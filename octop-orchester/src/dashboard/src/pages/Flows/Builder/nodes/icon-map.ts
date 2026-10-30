import { Box, type LucideIcon } from "lucide-react";

/**
 * Icon name -> lucide icon, the single map used by the palette and the canvas
 * cards. Starts empty: each node task adds the icon of its node here (the test
 * checks that every catalog icon is mapped and that every name is a real lucide
 * export).
 */
export const NODE_ICONS: Record<string, LucideIcon> = {};

export function iconFor(name: string | undefined): LucideIcon {
  return (
    (name &&
      Object.prototype.hasOwnProperty.call(NODE_ICONS, name) &&
      NODE_ICONS[name]) ||
    Box
  );
}
