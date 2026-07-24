import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合併 Tailwind class，後者覆蓋前者的同類屬性 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
