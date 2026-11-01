import assert from "node:assert/strict";
import test from "node:test";
import { startEvent, startScheduledEvent } from "../../convex/mutations";

// Convex registers functions as objects that keep the raw handler in
// `_handler`. We call it directly with a tiny fake ctx because the repo has no
// convex-test dependency.
type Handler = (
	ctx: unknown,
	args: { eventId: string },
) => Promise<{ success: boolean; skipped?: boolean; error?: string }>;

function handlerOf(fn: unknown): Handler {
	return (fn as { _handler: Handler })._handler;
}

type FakeEvent = {
	_id: string;
	teamId: string;
	status: string;
	scheduledAt: number;
	durationMinutes?: number;
	expectedEndTime?: number;
};

function makeCtx(event: FakeEvent | null) {
	const patches: Array<{ id: string; fields: Record<string, unknown> }> = [];
	const ctx = {
		// No identity, like a cron / scheduled function.
		auth: { getUserIdentity: async () => null },
		db: {
			get: async () => event,
			patch: async (id: string, fields: Record<string, unknown>) => {
				patches.push({ id, fields });
			},
		},
	};
	return { ctx, patches };
}

function scheduledEvent(overrides: Partial<FakeEvent> = {}): FakeEvent {
	return {
		_id: "event1",
		teamId: "team1",
		status: "scheduled",
		// Started a minute ago, 20 minute default duration: still running.
		scheduledAt: Date.now() - 60_000,
		...overrides,
	};
}

test("startScheduledEvent starts a scheduled event without an identity", async () => {
	const event = scheduledEvent();
	const { ctx, patches } = makeCtx(event);

	const result = await handlerOf(startScheduledEvent)(ctx, {
		eventId: event._id,
	});

	assert.deepEqual(result, { success: true });
	assert.equal(patches.length, 1);
	assert.equal(patches[0].id, event._id);
	assert.equal(patches[0].fields.status, "started");
	assert.equal(
		patches[0].fields.expectedEndTime,
		event.scheduledAt + 20 * 60_000,
	);
});

test("startScheduledEvent completes an event whose end time already passed", async () => {
	const event = scheduledEvent({
		scheduledAt: Date.now() - 60 * 60_000,
		durationMinutes: 10,
	});
	const { ctx, patches } = makeCtx(event);

	const result = await handlerOf(startScheduledEvent)(ctx, {
		eventId: event._id,
	});

	assert.deepEqual(result, { success: true });
	assert.equal(patches.length, 1);
	assert.equal(patches[0].fields.status, "completed");
	assert.equal(patches[0].fields.expectedEndTime, undefined);
});

for (const status of ["started", "completed", "cancelled"]) {
	test(`startScheduledEvent is a no-op for a ${status} event`, async () => {
		const event = scheduledEvent({ status });
		const { ctx, patches } = makeCtx(event);

		const result = await handlerOf(startScheduledEvent)(ctx, {
			eventId: event._id,
		});

		assert.deepEqual(result, { success: true, skipped: true });
		assert.equal(patches.length, 0);
	});
}

test("startScheduledEvent is a no-op for a missing event", async () => {
	const { ctx, patches } = makeCtx(null);

	const result = await handlerOf(startScheduledEvent)(ctx, {
		eventId: "missing",
	});

	assert.deepEqual(result, { success: true, skipped: true });
	assert.equal(patches.length, 0);
});

test("public startEvent still rejects callers without an identity", async () => {
	const event = scheduledEvent();
	const { ctx, patches } = makeCtx(event);

	await assert.rejects(
		handlerOf(startEvent)(ctx, { eventId: event._id }),
		/Unauthorized/,
	);
	assert.equal(patches.length, 0);
});

test("public startEvent reports a missing event before checking auth", async () => {
	const { ctx, patches } = makeCtx(null);

	const result = await handlerOf(startEvent)(ctx, { eventId: "missing" });

	assert.deepEqual(result, { success: false, error: "Event not found" });
	assert.equal(patches.length, 0);
});
