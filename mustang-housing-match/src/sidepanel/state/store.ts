import { useEffect, useState } from "preact/hooks";

export interface Store<S> {
  get(): S;
  set(next: S | ((prev: S) => S)): void;
  subscribe(listener: (s: S) => void): () => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<(s: S) => void>();
  return {
    get: () => state,
    set(next) {
      state = typeof next === "function" ? (next as (p: S) => S)(state) : next;
      for (const l of listeners) l(state);
    },
    subscribe(l) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export function useStore<S>(store: Store<S>): S {
  const [state, setState] = useState(store.get());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}
