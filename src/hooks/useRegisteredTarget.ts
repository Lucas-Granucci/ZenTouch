import { useLayoutEffect, useRef } from 'react';
import type { TargetRegistry } from '../types/interaction.ts';

/** Poll layout as well as observing resize: transforms and sibling layout shifts need no resize event. */
export function useRegisteredTarget<T extends HTMLElement>(registry: TargetRegistry, id: string, enabled = true, priority = 1, softSnap = false) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { id, enabled: enabled && !node.matches(':disabled') && !node.closest('[inert]') && style.visibility !== 'hidden' && style.display !== 'none', priority, softSnap,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    };
    const initial = measure();
    const unregister = registry.register(initial);
    let previous = JSON.stringify(initial);
    let animation = 0;
    const update = () => {
      const target = measure(), next = JSON.stringify(target);
      if (next !== previous) { previous = next; registry.update(target); }
    };
    const poll = () => { update(); animation = requestAnimationFrame(poll); };
    const observer = new ResizeObserver(update); observer.observe(node);
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    animation = requestAnimationFrame(poll);
    return () => { cancelAnimationFrame(animation); observer.disconnect(); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); unregister(); };
  }, [registry, id, enabled, priority, softSnap]);
  return ref;
}
