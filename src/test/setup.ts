import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * jsdom has no IntersectionObserver. Framer Motion's `useInView` (behind
 * `KpiNumber`'s count-up) needs one, so give every component test a stub that
 * reports "not intersecting" and never fires.
 */
class NoopIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
}

if (!('IntersectionObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: NoopIntersectionObserver,
  });
}
