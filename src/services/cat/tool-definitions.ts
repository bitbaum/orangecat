/** Keep the first declaration when platform and action tools share a name. */
export function uniqueToolDefinitions<T extends { function: { name: string } }>(tools: T[]): T[] {
  const names = new Set<string>();
  return tools.filter(tool => {
    if (names.has(tool.function.name)) {
      return false;
    }
    names.add(tool.function.name);
    return true;
  });
}
