window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Storage = (() => {
  const { storageKey, snapshotKey } = window.LaunchFlow.State;

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error('Storage read failed', error);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage write failed', error);
      return false;
    }
  }

  return {
    loadWorkspace() {
      return safeRead(storageKey, null);
    },
    saveWorkspace(workspace) {
      return safeWrite(storageKey, workspace);
    },
    clearWorkspace() {
      localStorage.removeItem(storageKey);
    },
    listSnapshots() {
      return safeRead(snapshotKey, []);
    },
    saveSnapshot(snapshot) {
      const snapshots = safeRead(snapshotKey, []);
      snapshots.unshift(snapshot);
      safeWrite(snapshotKey, snapshots.slice(0, 12));
    },
    deleteSnapshot(snapshotId) {
      const snapshots = safeRead(snapshotKey, []).filter((entry) => entry.id !== snapshotId);
      safeWrite(snapshotKey, snapshots);
    }
  };
})();
