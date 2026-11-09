export type SessionStatus =
  | "idle"
  | "preflight"
  | "connecting"
  | "queued"
  | "connected"
  | "generating"
  | "reconnecting"
  | "disconnected"
  | "error";

export type NetQuality = "good" | "fair" | "poor" | "critical";

export type SessionCallbacks = {
  onRemoteStream: (stream: MediaStream) => void;
  onStatus: (s: SessionStatus) => void;
  onQuality?: (q: NetQuality, detail?: string) => void;
  onQueue?: (q: { position: number; queueSize: number } | null) => void;
  /** Seconds of generation billed so far in this session. */
  onTick?: (seconds: number) => void;
  /** Terminal end decided by the server (time limit, credits, moderation...). */
  onEnded?: (reason: string) => void;
  onError?: (message: string) => void;
};

export type PreflightResult = { quality: NetQuality; reasons: string[] };

export interface TryOnSession {
  setGarment(image: Blob, prompt: string, enhance: boolean): Promise<void>;
  setPrompt(prompt: string, enhance: boolean): Promise<void>;
  clearGarment(): Promise<void>;
  disconnect(): void;
}

export interface TryOnProvider {
  readonly name: "decart" | "mock";
  preflight(sessionId: string): Promise<PreflightResult>;
  connect(stream: MediaStream, sessionId: string, cb: SessionCallbacks): Promise<TryOnSession>;
}
