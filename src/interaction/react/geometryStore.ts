import type { TargetRegistry } from '../../types/interaction.ts';

/** Cache registries that return fresh arrays, as required by useSyncExternalStore. */
export function createGeometryStore(registry: TargetRegistry) {
  let targets = registry.getSnapshot();
  return { getSnapshot: () => targets, subscribe: (listener: () => void) => {
    const unsubscribe = registry.subscribe(() => { targets = registry.getSnapshot(); listener(); });
    targets = registry.getSnapshot();
    return unsubscribe;
  } };
}
