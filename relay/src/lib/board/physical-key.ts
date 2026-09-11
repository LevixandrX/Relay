/** Physical letter from a KeyboardEvent, independent of OS layout. */
export function physicalLetter(e: KeyboardEvent): string {
  if (e.code.startsWith("Key") && e.code.length === 4) return e.code.slice(3).toLowerCase();
  return "";
}

export function physicalDigit(e: KeyboardEvent): string {
  if (e.code.startsWith("Digit")) return e.code.slice(5);
  if (e.code.startsWith("Numpad") && e.code.length === 7) return e.code.slice(6);
  return "";
}

export function isModifiedLetter(e: KeyboardEvent, letter: string) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const phys = physicalLetter(e);
  return phys === letter || e.key.toLowerCase() === letter;
}
