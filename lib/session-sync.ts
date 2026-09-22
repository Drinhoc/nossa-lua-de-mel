// One GET at a time. Only mutations invalidate snapshots, never the next poll.
export function createSessionSync<T>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  accept: (value: T) => void;
  fail: (error: unknown) => void;
  visible?: () => boolean;
  interval?: number;
}) {
  const interval = options.interval ?? 1500;
  let stopped = false, running = false, pending = false, mutations = 0, epoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  function schedule() { clear(); if (!stopped) timer = setTimeout(() => void run(), interval); }
  async function run() {
    if (stopped || running || mutations) return;
    clear();
    if (options.visible && !options.visible()) { schedule(); return; }
    running = true; pending = false;
    const version = epoch;
    controller = new AbortController();
    try {
      const value = await options.load(controller.signal);
      if (!stopped && !mutations && version === epoch) options.accept(value);
    } catch (error) {
      if (!stopped && !mutations && version === epoch) options.fail(error);
    } finally {
      running = false; controller = undefined;
      if (!stopped && !mutations) {
        if (pending) { pending = false; void run(); }
        else schedule();
      }
    }
  }
  return {
    start() { void run(); },
    refresh() { if (stopped) return; if (running || mutations) pending = true; else void run(); },
    beginMutation() { mutations++; epoch++; clear(); controller?.abort(); },
    endMutation() { mutations = Math.max(0, mutations - 1); epoch++; if (!mutations) this.refresh(); },
    stop() { stopped = true; epoch++; clear(); controller?.abort(); },
  };
}
