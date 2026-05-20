import { listen, UnlistenFn } from "@tauri-apps/api/event";

type EventName =
  | "git-status-changed"
  | "git-branch-changed"
  | "git-log-changed"
  | "master-plan-changed"
  | "ports-changed"
  | "code-review-changed"
  | "env-changed"
  | "file-system-changed";

type Callback<T = unknown> = (payload: T) => void;

interface Subscription {
  event: EventName;
  callback: Callback;
  unlisten: UnlistenFn | null;
  unlistenPromise: Promise<UnlistenFn> | null;
}

class EventBusService {
  private subscriptions: Subscription[] = [];

  subscribe<T = unknown>(event: EventName, callback: Callback<T>): () => void {
    const sub: Subscription = { event, callback: callback as Callback, unlisten: null, unlistenPromise: null };

    listen<T>(event, (e) => {
      callback(e.payload);
    }).then((unlisten) => {
      sub.unlisten = unlisten;
    });

    this.subscriptions.push(sub);

    return () => this.unsubscribe(sub);
  }

  private unsubscribe(sub: Subscription) {
    const idx = this.subscriptions.indexOf(sub);
    if (idx !== -1) {
      this.subscriptions.splice(idx, 1);
      if (sub.unlisten) {
        sub.unlisten();
      } else if (sub.unlistenPromise) {
        sub.unlistenPromise.then((unlisten) => unlisten());
      }
    }
  }

  unsubscribeAll() {
    const subs = [...this.subscriptions];
    for (const sub of subs) {
      if (sub.unlisten) {
        sub.unlisten();
      } else if (sub.unlistenPromise) {
        sub.unlistenPromise.then((unlisten) => unlisten());
      }
    }
    this.subscriptions = [];
  }

  getActiveSubscriptions() {
    return this.subscriptions.map(s => s.event);
  }
}

export const eventBus = new EventBusService();

export type { EventName };
