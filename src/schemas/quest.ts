import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

export const QuestState = z.enum([
	"hook",
	"active",
	"completed",
	"failed",
	"abandoned",
]);
export type QuestState = z.infer<typeof QuestState>;

const Objective = z.object({
	text: z.string().min(1),
	done: z.boolean().default(false),
});

export const QuestSchema = BaseEntity.extend({
	kind: z.literal("quest"),
	state: QuestState.default("hook"),
	giver: Wikilink.optional(),
	location: Wikilink.optional(),
	objectives: z.array(Objective).default([]),
	rewards: z.array(z.string()).default([]),
	related: WikilinkArray,
	secrets: z.array(z.string()).default([]),
	deadline: z.string().optional(),
	hook: z.string().optional(),
});
export type Quest = z.infer<typeof QuestSchema>;
