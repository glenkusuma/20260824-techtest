/** Reads a `--name=value` CLI argument from `process.argv`.
 * @param name The argument name to look up.
 * @param fallback Value returned when the argument is absent.
 * @returns The argument's value, or `fallback` when it is not present.
 */
export const getArg = (name: string, fallback?: string): string | undefined => {
  const prefix = `--${name}=`;
  return (
    process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    fallback
  );
};
