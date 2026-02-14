/**
 * Utility for merging Tailwind CSS class names
 *
 * Combines `clsx` for conditional class composition with `tailwind-merge` to resolve
 * Tailwind CSS conflicts (e.g., when `px-4` and `px-8` appear together, the latter wins).
 * This is the standard pattern for modern Tailwind projects using shadcn/ui.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges CSS class names with Tailwind conflict resolution.
 *
 * @param inputs - CSS class names (strings, arrays, objects per clsx syntax)
 * @returns Merged class string with Tailwind conflicts resolved
 *
 * @example
 * ```tsx
 * cn('px-4 py-2', { 'bg-blue-500': isActive }, ['rounded-lg', 'text-white'])
 * // => 'px-4 py-2 rounded-lg text-white' (with 'bg-blue-500' if isActive is true)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
