// API identifiers may equal Object.prototype names. Never treat inherited properties as records.
export function getOwn<T>(
  record: Record<string, T>,
  key: string,
): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
