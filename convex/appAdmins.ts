import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
	assertAppAdmin,
	getEnvAdminEmails,
	isEnvAdminEmail,
	normalizeEmail,
} from "./authz";

const MAX_NOTE_LENGTH = 200;

/**
 * Admin roster management.
 *
 * ADMIN_ALLOWLIST_EMAILS is checked before this table and is intentionally NOT
 * editable here: it is the break-glass that makes a damaged roster recoverable
 * without shell access to the Convex deployment.
 */
export const listAdmins = query({
	args: {},
	handler: async (ctx) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);
		const stored = await ctx.db.query("appAdmins").collect();
		const envEmails = getEnvAdminEmails();

		return {
			currentEmail: normalizedEmail,
			/** Not removable from the console; shown so the operator knows why. */
			envAdmins: envEmails,
			admins: stored
				.map((row) => ({
					_id: row._id,
					email: row.email,
					note: row.note ?? null,
					source: row.source,
					createdAt: row.createdAt,
					createdByEmail: row.createdByEmail ?? null,
					alsoInEnv: envEmails.includes(row.email),
				}))
				.sort((a, b) => a.email.localeCompare(b.email)),
		};
	},
});

export const addAdmin = mutation({
	args: { email: v.string(), note: v.optional(v.string()) },
	handler: async (ctx, { email, note }) => {
		const { normalizedEmail: actorEmail } = await assertAppAdmin(ctx);

		const target = normalizeEmail(email);
		if (!target?.includes("@")) {
			throw new Error("Enter a valid email address");
		}

		const existing = await ctx.db
			.query("appAdmins")
			.withIndex("by_email", (q) => q.eq("email", target))
			.first();
		if (existing) {
			return { added: false, email: target };
		}

		const trimmedNote = note?.trim();
		await ctx.db.insert("appAdmins", {
			email: target,
			note:
				trimmedNote && trimmedNote.length > 0
					? trimmedNote.slice(0, MAX_NOTE_LENGTH)
					: undefined,
			source: "manual",
			createdAt: Date.now(),
			createdByEmail: actorEmail ?? undefined,
		});
		return { added: true, email: target };
	},
});

export const removeAdmin = mutation({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		const { normalizedEmail: actorEmail } = await assertAppAdmin(ctx);

		const target = normalizeEmail(email);
		if (!target) {
			throw new Error("Enter a valid email address");
		}

		const row = await ctx.db
			.query("appAdmins")
			.withIndex("by_email", (q) => q.eq("email", target))
			.first();
		if (!row) {
			// Removing an env admin is the one case worth an explicit message:
			// it looks like a no-op otherwise.
			if (isEnvAdminEmail(target)) {
				throw new Error(
					"This admin comes from ADMIN_ALLOWLIST_EMAILS and can only be removed from the environment",
				);
			}
			return { removed: false, email: target };
		}

		// Two lockout guards. The second is the one that matters on a
		// self-hosted instance where the operator has cleared the env var.
		if (target === actorEmail && !isEnvAdminEmail(target)) {
			const remaining = await ctx.db.query("appAdmins").take(2);
			if (remaining.length <= 1 && getEnvAdminEmails().length === 0) {
				throw new Error("You are the last admin and cannot remove yourself");
			}
		}

		const all = await ctx.db.query("appAdmins").take(2);
		if (all.length <= 1 && getEnvAdminEmails().length === 0) {
			throw new Error(
				"Removing the last admin would lock everyone out. Set ADMIN_ALLOWLIST_EMAILS first",
			);
		}

		await ctx.db.delete(row._id);
		return { removed: true, email: target };
	},
});

/**
 * Copies ADMIN_ALLOWLIST_EMAILS into the table so a fresh instance starts with
 * a visible, editable roster. Run explicitly from the console: doing this
 * implicitly on a read path would turn every query into a write.
 */
export const seedAdminsFromEnv = mutation({
	args: { dryRun: v.optional(v.boolean()) },
	handler: async (ctx, { dryRun = true }) => {
		const { normalizedEmail: actorEmail } = await assertAppAdmin(ctx);

		const envEmails = getEnvAdminEmails();
		const created: string[] = [];
		const skipped: string[] = [];

		for (const email of envEmails) {
			const existing = await ctx.db
				.query("appAdmins")
				.withIndex("by_email", (q) => q.eq("email", email))
				.first();
			if (existing) {
				skipped.push(email);
				continue;
			}
			created.push(email);
			if (!dryRun) {
				await ctx.db.insert("appAdmins", {
					email,
					source: "bootstrap",
					createdAt: Date.now(),
					createdByEmail: actorEmail ?? undefined,
				});
			}
		}

		return { dryRun, created, skipped, envCount: envEmails.length };
	},
});
