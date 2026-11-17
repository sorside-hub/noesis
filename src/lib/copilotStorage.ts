import { CopilotChatMessage } from '../types';

const STORAGE_KEY = 'noesis_copilot_sessions_v1';
const MAX_SESSIONS = 25;
const MAX_MESSAGES_PER_SESSION = 30;

export interface StoredCopilotSession {
  updatedAt: string;
  messages: CopilotChatMessage[];
}

type SessionStore = Record<string, StoredCopilotSession>;

const readStore = (): SessionStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SessionStore) : {};
  } catch {
    return {};
  }
};

const writeStore = (store: SessionStore) => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(store)
      .sort(
        (a, b) =>
          new Date(b[1]?.updatedAt || 0).getTime() - new Date(a[1]?.updatedAt || 0).getTime()
      )
      .slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage quota errors cleanly
  }
};

export const sanitizeCopilotMessages = (messages: CopilotChatMessage[]): CopilotChatMessage[] => {
  return messages.slice(-MAX_MESSAGES_PER_SESSION).map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.text,
    createdAt: msg.createdAt,
    attachedTitles: msg.attachedTitles,
    modelUsed: msg.modelUsed,
    fallbackUsed: msg.fallbackUsed,
  }));
};

export const loadCopilotSession = (sessionKey: string): StoredCopilotSession | null => {
  if (!sessionKey) return null;
  const store = readStore();
  const entry = store[sessionKey];
  if (!entry || !Array.isArray(entry.messages)) return null;
  return {
    updatedAt: String(entry.updatedAt || ''),
    messages: entry.messages,
  };
};

export const loadCopilotMessages = (sessionKey: string): CopilotChatMessage[] => {
  return loadCopilotSession(sessionKey)?.messages || [];
};

export const saveCopilotMessages = (
  sessionKey: string,
  messages: CopilotChatMessage[],
  updatedAt?: string
) => {
  if (!sessionKey) return;
  const store = readStore();
  if (messages.length === 0) {
    delete store[sessionKey];
    writeStore(store);
    return;
  }

  store[sessionKey] = {
    updatedAt: updatedAt || new Date().toISOString(),
    messages: sanitizeCopilotMessages(messages),
  };
  writeStore(store);
};

export const clearCopilotMessages = (sessionKey: string) => {
  if (!sessionKey) return;
  const store = readStore();
  delete store[sessionKey];
  writeStore(store);
};
