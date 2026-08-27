import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves Tailwind conflicts, so later classes win.
 * Thin wrapper over `clsx` + `tailwind-merge` used by the UI component layer.
 * @param inputs Class expressions to combine (strings, conditionals, arrays).
 * @returns A single deduplicated class string.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
