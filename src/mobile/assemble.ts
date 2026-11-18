/** Replaces each `<!--@name-->` marker with the part of that name. Parts may contain markers themselves. */
export function assemble(shell: string, parts: Record<string, string>): string {
  let out = shell;
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(/<!--@([a-z-]+)-->/g, (all, name: string) => (name in parts ? parts[name] : all));
    if (next === out) break;
    out = next;
  }
  return out;
}
