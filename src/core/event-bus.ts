type Handler<T> = (payload: T) => void;

/** Typed internal pub/sub. Used by Session Runner and campaign-scribe sync. */
export class EventBus<Events> {
	private handlers: {
		[K in keyof Events]?: Set<Handler<Events[K]>>;
	} = {};

	on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
		const set = (this.handlers[event] ??= new Set());
		set.add(fn);
		return () => set.delete(fn);
	}

	emit<K extends keyof Events>(event: K, payload: Events[K]): void {
		const set = this.handlers[event];
		if (!set) return;
		for (const fn of set) fn(payload);
	}
}

export interface CampaignEvents {
	"entity.created": { path: string; kind: string };
	"entity.updated": { path: string; kind: string };
	"npc.met": { npc: string; session: string };
	"quest.advanced": { quest: string; state: string };
	"loot.taken": { item: string; owner?: string };
}
