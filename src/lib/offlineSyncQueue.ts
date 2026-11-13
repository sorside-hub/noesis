// Persistent Outbox Queue for Logged-In Offline-First Sync
// Supabase remains the Strict Single Source of Truth (Server/Timestamp Wins)

export const PENDING_SYNC_QUEUE_KEY = 'noesis_pending_sync_queue';

export interface QueuedUpsertEntry {
  id: string;
  updatedAt: string;
  isNew?: boolean;
}

export interface PendingSyncQueue {
  userId?: string;
  upsertNotes: Record<string, QueuedUpsertEntry>;
  deleteNoteIds: string[];
  upsertFragments: Record<string, QueuedUpsertEntry>;
  deleteFragmentIds: string[];
  upsertConnections: Record<string, { pairKey: string; updatedAt: string }>;
  deleteConnectionPairKeys: string[];
}

export const createEmptySyncQueue = (userId?: string): PendingSyncQueue => ({
  userId,
  upsertNotes: {},
  deleteNoteIds: [],
  upsertFragments: {},
  deleteFragmentIds: [],
  upsertConnections: {},
  deleteConnectionPairKeys: [],
});

export const loadPendingSyncQueue = (expectedUserId?: string): PendingSyncQueue => {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
    if (!raw) return createEmptySyncQueue(expectedUserId);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createEmptySyncQueue(expectedUserId);
    }
    if (expectedUserId && parsed.userId && parsed.userId !== expectedUserId) {
      return createEmptySyncQueue(expectedUserId);
    }
    return {
      userId: expectedUserId || parsed.userId,
      upsertNotes:
        parsed.upsertNotes && typeof parsed.upsertNotes === 'object' ? parsed.upsertNotes : {},
      deleteNoteIds: Array.isArray(parsed.deleteNoteIds) ? parsed.deleteNoteIds : [],
      upsertFragments:
        parsed.upsertFragments && typeof parsed.upsertFragments === 'object'
          ? parsed.upsertFragments
          : {},
      deleteFragmentIds: Array.isArray(parsed.deleteFragmentIds) ? parsed.deleteFragmentIds : [],
      upsertConnections:
        parsed.upsertConnections && typeof parsed.upsertConnections === 'object'
          ? parsed.upsertConnections
          : {},
      deleteConnectionPairKeys: Array.isArray(parsed.deleteConnectionPairKeys)
        ? parsed.deleteConnectionPairKeys
        : [],
    };
  } catch {
    return createEmptySyncQueue(expectedUserId);
  }
};

export const savePendingSyncQueue = (queue: PendingSyncQueue) => {
  try {
    if (!hasPendingSyncItems(queue)) {
      localStorage.removeItem(PENDING_SYNC_QUEUE_KEY);
      return;
    }
    localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota errors
  }
};

export const clearPendingSyncQueue = () => {
  try {
    localStorage.removeItem(PENDING_SYNC_QUEUE_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const hasPendingSyncItems = (queue: PendingSyncQueue): boolean => {
  return (
    Object.keys(queue.upsertNotes).length > 0 ||
    queue.deleteNoteIds.length > 0 ||
    Object.keys(queue.upsertFragments).length > 0 ||
    queue.deleteFragmentIds.length > 0 ||
    Object.keys(queue.upsertConnections).length > 0 ||
    queue.deleteConnectionPairKeys.length > 0
  );
};

export const countPendingSyncItems = (queue: PendingSyncQueue): number => {
  return (
    Object.keys(queue.upsertNotes).length +
    queue.deleteNoteIds.length +
    Object.keys(queue.upsertFragments).length +
    queue.deleteFragmentIds.length +
    Object.keys(queue.upsertConnections).length +
    queue.deleteConnectionPairKeys.length
  );
};

export const enqueueUpsertNote = (
  userId: string,
  noteId: string,
  updatedAt: string,
  isNew = false
) => {
  const queue = loadPendingSyncQueue(userId);
  const existing = queue.upsertNotes[noteId];
  queue.deleteNoteIds = queue.deleteNoteIds.filter((id) => id !== noteId);
  queue.upsertNotes[noteId] = {
    id: noteId,
    updatedAt,
    isNew: Boolean(isNew || existing?.isNew),
  };
  savePendingSyncQueue(queue);
};

export const dequeueUpsertNote = (
  userId: string,
  noteId: string,
  syncedUpdatedAt?: string
) => {
  const queue = loadPendingSyncQueue(userId);
  const existing = queue.upsertNotes[noteId];
  if (!existing) return;
  if (
    syncedUpdatedAt &&
    Date.parse(existing.updatedAt) > Date.parse(syncedUpdatedAt)
  ) {
    // A newer edit was queued after this sync started; keep it queued
    return;
  }
  delete queue.upsertNotes[noteId];
  savePendingSyncQueue(queue);
};

export const enqueueDeleteNote = (userId: string, noteId: string) => {
  const queue = loadPendingSyncQueue(userId);
  const wasCreatedOfflineOnly = Boolean(queue.upsertNotes[noteId]?.isNew);
  delete queue.upsertNotes[noteId];
  if (!wasCreatedOfflineOnly && !queue.deleteNoteIds.includes(noteId)) {
    queue.deleteNoteIds.push(noteId);
  }
  savePendingSyncQueue(queue);
};

export const dequeueDeleteNote = (userId: string, noteId: string) => {
  const queue = loadPendingSyncQueue(userId);
  queue.deleteNoteIds = queue.deleteNoteIds.filter((id) => id !== noteId);
  savePendingSyncQueue(queue);
};

export const enqueueUpsertFragment = (
  userId: string,
  fragmentId: string,
  updatedAt: string,
  isNew = false
) => {
  const queue = loadPendingSyncQueue(userId);
  const existing = queue.upsertFragments[fragmentId];
  queue.deleteFragmentIds = queue.deleteFragmentIds.filter((id) => id !== fragmentId);
  queue.upsertFragments[fragmentId] = {
    id: fragmentId,
    updatedAt,
    isNew: Boolean(isNew || existing?.isNew),
  };
  savePendingSyncQueue(queue);
};

export const dequeueUpsertFragment = (
  userId: string,
  fragmentId: string,
  syncedUpdatedAt?: string
) => {
  const queue = loadPendingSyncQueue(userId);
  const existing = queue.upsertFragments[fragmentId];
  if (!existing) return;
  if (
    syncedUpdatedAt &&
    Date.parse(existing.updatedAt) > Date.parse(syncedUpdatedAt)
  ) {
    return;
  }
  delete queue.upsertFragments[fragmentId];
  savePendingSyncQueue(queue);
};

export const enqueueDeleteFragment = (userId: string, fragmentId: string) => {
  const queue = loadPendingSyncQueue(userId);
  const wasCreatedOfflineOnly = Boolean(queue.upsertFragments[fragmentId]?.isNew);
  delete queue.upsertFragments[fragmentId];
  if (!wasCreatedOfflineOnly && !queue.deleteFragmentIds.includes(fragmentId)) {
    queue.deleteFragmentIds.push(fragmentId);
  }
  savePendingSyncQueue(queue);
};

export const dequeueDeleteFragment = (userId: string, fragmentId: string) => {
  const queue = loadPendingSyncQueue(userId);
  queue.deleteFragmentIds = queue.deleteFragmentIds.filter((id) => id !== fragmentId);
  savePendingSyncQueue(queue);
};

export const enqueueUpsertConnection = (
  userId: string,
  pairKey: string,
  updatedAt: string
) => {
  const queue = loadPendingSyncQueue(userId);
  queue.deleteConnectionPairKeys = queue.deleteConnectionPairKeys.filter((k) => k !== pairKey);
  queue.upsertConnections[pairKey] = { pairKey, updatedAt };
  savePendingSyncQueue(queue);
};

export const dequeueUpsertConnection = (
  userId: string,
  pairKey: string,
  syncedUpdatedAt?: string
) => {
  const queue = loadPendingSyncQueue(userId);
  const existing = queue.upsertConnections[pairKey];
  if (!existing) return;
  if (
    syncedUpdatedAt &&
    Date.parse(existing.updatedAt) > Date.parse(syncedUpdatedAt)
  ) {
    return;
  }
  delete queue.upsertConnections[pairKey];
  savePendingSyncQueue(queue);
};

export const enqueueDeleteConnection = (userId: string, pairKey: string) => {
  const queue = loadPendingSyncQueue(userId);
  delete queue.upsertConnections[pairKey];
  if (!queue.deleteConnectionPairKeys.includes(pairKey)) {
    queue.deleteConnectionPairKeys.push(pairKey);
  }
  savePendingSyncQueue(queue);
};

export const dequeueDeleteConnection = (userId: string, pairKey: string) => {
  const queue = loadPendingSyncQueue(userId);
  queue.deleteConnectionPairKeys = queue.deleteConnectionPairKeys.filter((k) => k !== pairKey);
  savePendingSyncQueue(queue);
};
