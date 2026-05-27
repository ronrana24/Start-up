import type { ClipboardEvent, KeyboardEvent } from "react";

/**
 * Strip every non-digit character from a string. Used to sanitize values
 * before storing them in state so an integer-only input never holds `1.5`,
 * `1e2`, or other non-integer characters.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Block keyboard input that would introduce a non-integer character: the
 * decimal separators (`.`, `,`), scientific notation (`e`, `E`), and signed
 * notation (`+`, `-`). Editing keys (Backspace, Arrow*, Tab, …) pass through
 * because they don't produce a character.
 */
export function blockNonIntegerKeys(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (["e", "E", "+", "-", ".", ","].includes(event.key)) {
    event.preventDefault();
  }
}

/**
 * Sanitize pasted text so pasting "12.5" results in "125" (digits-only)
 * rather than the browser silently accepting an invalid value into a
 * `type="number"` field.
 */
export function sanitizeIntegerPaste(
  event: ClipboardEvent<HTMLInputElement>,
  onValue: (value: string) => void,
): void {
  const pasted = event.clipboardData.getData("text");
  const cleaned = digitsOnly(pasted);
  if (cleaned !== pasted) {
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + cleaned + input.value.slice(end);
    onValue(next);
  }
}
