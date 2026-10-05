/** Serializes this editor's writes. It is not a database lock or cross-tab transaction. */
export function createWorkspaceSaveQueue() {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(write: () => Promise<void>, allowed: () => boolean = () => true): Promise<boolean> {
      const result = tail.then(async () => {
        if (!allowed()) return false;
        await write();
        return true;
      });
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
