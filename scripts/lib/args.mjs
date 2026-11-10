/** `--root <dir>` (repeatable) overrides default scan roots. Tests only. */
export function roots(defaults) {
  const argv = process.argv.slice(2);
  const given = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) given.push(argv[++i]);
  }
  return given.length > 0 ? given : defaults;
}
