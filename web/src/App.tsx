import { useCallback, useEffect, useState } from 'react';
import { fetchFolders, type FolderSummary } from './api.js';
import { SwipeSession } from './components/SwipeSession.js';
import { FolderPicker } from './components/FolderPicker.js';

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function folderIdFromHash(hash: string): string | null {
  const m = hash.match(/^#\/f\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function App() {
  const hash = useHash();
  const [folders, setFolders] = useState<FolderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedId = folderIdFromHash(hash);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetchFolders();
      setFolders(res.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, []);

  // Load on mount, and refresh progress every time we return to the picker.
  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);
  useEffect(() => {
    if (!selectedId) void loadFolders();
  }, [selectedId, loadFolders]);

  if (error && !folders) {
    return (
      <div className="app">
        <div className="deck__msg deck__msg--error">{error}</div>
      </div>
    );
  }
  if (!folders) {
    return (
      <div className="app">
        <div className="deck__msg">Loading…</div>
      </div>
    );
  }

  // Single folder → skip the picker entirely (preserves the original UX).
  if (folders.length === 1) {
    const f = folders[0];
    return <SwipeSession folderId={f.id} folderName={f.name} showBack={false} onBack={() => {}} />;
  }

  const selected = selectedId ? folders.find((f) => f.id === selectedId) : null;
  if (selected) {
    return (
      <SwipeSession
        key={selected.id}
        folderId={selected.id}
        folderName={selected.name}
        showBack
        onBack={() => {
          window.location.hash = '#/';
        }}
      />
    );
  }

  return (
    <FolderPicker
      folders={folders}
      onPick={(id) => {
        window.location.hash = `#/f/${encodeURIComponent(id)}`;
      }}
    />
  );
}
