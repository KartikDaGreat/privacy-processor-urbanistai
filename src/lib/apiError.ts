import { DetectionError } from "./detect";
import { modelLabel } from "./types";

/**
 * Turns a pipeline failure into a message that says which model failed and why.
 * A bare "Processing failed" is never an acceptable answer here.
 *
 * Everything runs in the browser, so the failure modes are about loading the
 * local model files and wasm runtimes rather than about a remote service.
 */
export function describeProcessingError(error: unknown): string {
  const modelPrefix =
    error instanceof DetectionError ? `${modelLabel(error.modelId)}: ` : "";
  const message = rawMessage(error);

  return modelPrefix + explain(message);
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "an unexpected error occurred.";
}

function explain(message: string): string {
  const lower = message.toLowerCase();

  // A model file or runtime is missing from public/ — the usual first-run problem.
  if (lower.includes("http 404") || lower.includes("not found")) {
    return `model file not found. Run \`npm run fetch-models\` to download the models into public/, then reload. (${message})`;
  }

  // fetch() rejects rather than resolving when the network or file server is unreachable.
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return `could not read its model files. If you are running the dev server, make sure it is still up; otherwise re-run \`npm run fetch-models\`. (${message})`;
  }

  if (lower.includes("http 5")) {
    return `the file server errored while sending the model. Try again in a moment. (${message})`;
  }

  if (lower.includes("wasm") || lower.includes("runtime failed to start")) {
    return `its WebAssembly runtime could not start. This browser may block WebAssembly, or the runtime files in public/vendor are incomplete. (${message})`;
  }

  if (lower.includes("out of memory") || lower.includes("allocation")) {
    return `ran out of memory on this image. Try a smaller photo. (${message})`;
  }

  if (lower.includes("could not be decoded")) {
    return message;
  }

  // Anything else: surface the underlying text rather than swallowing it.
  return message.endsWith(".") ? message : `${message}.`;
}
