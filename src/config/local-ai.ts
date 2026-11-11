/**
 * Local AI runtimes — SSOT for "Run locally".
 *
 * A local model runs on the USER's machine (Ollama, LM Studio), so the
 * browser talks to it directly at localhost — never our server, which can't
 * reach a user's machine. Browsers exempt http://localhost from
 * mixed-content blocking, so this works from https://orangecat.ch; the only
 * setup a user needs is allowing our origin in the runtime's CORS config
 * (the `corsSetup` command below).
 *
 * Everything about a runtime lives HERE: probe URL, chat URL, setup copy.
 * The settings panel, the model selector, and the local chat path all
 * derive from this list — adding a runtime is one entry, zero code.
 */

export interface LocalRuntime {
  id: string;
  name: string;
  /** OpenAI-compatible base (…/v1) served by the runtime on localhost. */
  baseUrl: string;
  /** Endpoint that lists installed models — also used as the reachability probe. */
  modelsUrl: string;
  /** Where to download the runtime. */
  downloadUrl: string;
  /** Shell command that starts the runtime with our origin allowed (CORS). */
  corsSetup: string;
  /** One-line description for the settings card. */
  description: string;
}

export const LOCAL_RUNTIMES: LocalRuntime[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    modelsUrl: 'http://localhost:11434/v1/models',
    downloadUrl: 'https://ollama.com/download',
    corsSetup: 'OLLAMA_ORIGINS="https://orangecat.ch" ollama serve',
    description:
      'Run open models on your own machine. Conversation storage and actions still use OrangeCat.',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    modelsUrl: 'http://localhost:1234/v1/models',
    downloadUrl: 'https://lmstudio.ai',
    corsSetup: 'In LM Studio: Developer → Local Server → enable CORS, then Start Server',
    description: 'Desktop app for running open models locally with an OpenAI-compatible API.',
  },
];

export function getLocalRuntime(id: string): LocalRuntime | undefined {
  return LOCAL_RUNTIMES.find(r => r.id === id);
}

/**
 * Local models travel through the UI as `local:<runtime>:<model>` so the
 * chat layer can tell "stream from localhost" apart from server models
 * without a parallel state field.
 */
export const LOCAL_MODEL_PREFIX = 'local:';

export function makeLocalModelId(runtimeId: string, model: string): string {
  return `${LOCAL_MODEL_PREFIX}${runtimeId}:${model}`;
}

export function parseLocalModelId(id: string): { runtimeId: string; model: string } | null {
  if (!id.startsWith(LOCAL_MODEL_PREFIX)) {
    return null;
  }
  const rest = id.slice(LOCAL_MODEL_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep <= 0 || sep === rest.length - 1) {
    return null;
  }
  return { runtimeId: rest.slice(0, sep), model: rest.slice(sep + 1) };
}
