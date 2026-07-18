// Model selection (#57): lifted out of the client so no call site pins a
// model id. Overridable per environment; the default must stay a current,
// vision-capable model — the calendar photo path depends on it.

const DEFAULT_MODEL = "claude-sonnet-5";

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}
