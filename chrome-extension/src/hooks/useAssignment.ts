import { useAction, useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";

const api = anyApi as any;

import { useCallback, useMemo, useState } from "react";
import type {
	AssignmentMode,
	AssignmentStatus,
	SlotConfig,
	SlotPreview,
	SlotStrategy,
} from "../types";

// ── Helpers ──

const createSlotId = () =>
	`slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function defaultSlotForMode(mode: AssignmentMode): SlotConfig {
	return {
		id: createSlotId(),
		strategy: mode === "regular" ? "random" : "tag_random_selected",
	};
}

export function normalizeSlotForMode(
	slot: SlotConfig,
	mode: AssignmentMode,
): SlotConfig {
	const next = { ...slot };
	if (mode === "regular") {
		if (next.strategy !== "random" && next.strategy !== "specific") {
			next.strategy = "random";
		}
	} else if (
		next.strategy !== "tag_random_selected" &&
		next.strategy !== "tag_random_other" &&
		next.strategy !== "specific"
	) {
		next.strategy = "tag_random_selected";
	}
	if (next.strategy !== "specific") next.reviewerId = undefined;
	if (next.strategy !== "tag_random_other") next.tagId = undefined;
	return next;
}

// ── Hook ──

export function useAssignment(teamSlug: string | null) {
	const [status, setStatus] = useState<AssignmentStatus>("idle");
	const [lastAssignedName, setLastAssignedName] = useState<string | null>(null);
	const [lastAssignerName, setLastAssignerName] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Queries — skip if no team selected
	const teams = useQuery(api.queries.getTeams) ?? [];

	const reviewers =
		useQuery(api.queries.getReviewers, teamSlug ? { teamSlug } : "skip") ?? [];

	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") ?? [];

	const nextReviewer = useQuery(
		api.queries.getNextReviewer,
		teamSlug ? { teamSlug } : "skip",
	);

	// Mutations & actions
	const assignPRMutation = useMutation(api.mutations.assignPR);
	const assignPRBatchMutation = useMutation(api.mutations.assignPRBatch);
	const sendChatAction = useAction(api.actions.sendGoogleChatMessage);
	const sendChatGroupAction = useAction(api.actions.sendGoogleChatGroupMessage);

	// Available (non-absent) reviewers
	const availableReviewers = useMemo(
		() => reviewers.filter((r: any) => !r.isAbsent),
		[reviewers],
	);

	// Find current user's reviewer record by email
	const findReviewerByEmail = useCallback(
		(email: string) => {
			return reviewers.find(
				(r: any) => r.email.toLowerCase() === email.toLowerCase(),
			);
		},
		[reviewers],
	);

	// Get next reviewer filtered by tag
	const getNextReviewerByTag = useCallback(
		(tagId: string) => {
			const tagged = availableReviewers.filter((r: any) =>
				r.tags.includes(tagId),
			);
			if (tagged.length === 0) return null;
			const minCount = Math.min(...tagged.map((r: any) => r.assignmentCount));
			const candidates = tagged.filter(
				(r: any) => r.assignmentCount === minCount,
			);
			candidates.sort((a: any, b: any) => a.createdAt - b.createdAt);
			return candidates[0] ?? null;
		},
		[availableReviewers],
	);

	// ── Client-side slot resolution (mirrors main app's resolvePreview) ──

	const resolveSlotPreview = useCallback(
		(
			slotConfigs: SlotConfig[],
			mode: AssignmentMode,
			selectedTagId?: string | null,
			currentUserReviewerId?: string,
		): {
			previews: SlotPreview[];
			payloadSlots: Array<{
				strategy: SlotStrategy;
				reviewerId?: string;
				tagId?: string;
			}>;
		} => {
			const previews: SlotPreview[] = [];
			const payloadSlots: Array<{
				strategy: SlotStrategy;
				reviewerId?: string;
				tagId?: string;
			}> = [];
			const selectedIds = new Set<string>();
			const virtualCounts = new Map<string, number>(
				reviewers.map((r: any) => [String(r._id), r.assignmentCount]),
			);
			const tagNameMap = new Map(tags.map((t: any) => [String(t._id), t.name]));

			for (const [slotIndex, rawSlot] of slotConfigs.entries()) {
				const slot = normalizeSlotForMode(rawSlot, mode);
				payloadSlots.push({
					strategy: slot.strategy,
					reviewerId: slot.reviewerId,
					tagId: slot.tagId,
				});

				const unresolved = (reason: string) => {
					previews.push({ slotIndex, status: "unresolved", reason });
				};

				// ── Specific strategy ──
				if (slot.strategy === "specific") {
					if (!slot.reviewerId) {
						unresolved("Selecciona un revisor");
						continue;
					}
					const target = reviewers.find(
						(r: any) => String(r._id) === slot.reviewerId,
					);
					if (!target) {
						unresolved("Revisor no encontrado");
						continue;
					}
					if (target.isAbsent) {
						unresolved("Revisor ausente");
						continue;
					}
					if (selectedIds.has(String(target._id))) {
						unresolved("Ya seleccionado");
						continue;
					}
					selectedIds.add(String(target._id));
					virtualCounts.set(String(target._id), target.assignmentCount + 1);
					previews.push({
						slotIndex,
						status: "resolved",
						reviewerName: target.name,
						tagName: slot.tagId
							? (tagNameMap.get(String(slot.tagId)) as string | undefined)
							: undefined,
					});
					continue;
				}

				// ── Random strategies ──
				let requiredTagId: string | undefined;
				if (mode === "regular") {
					if (slot.strategy !== "random") {
						unresolved("Estrategia inválida");
						continue;
					}
				} else {
					if (slot.strategy === "tag_random_selected") {
						requiredTagId = selectedTagId ?? undefined;
					} else if (slot.strategy === "tag_random_other") {
						requiredTagId = slot.tagId;
					} else {
						unresolved("Estrategia inválida");
						continue;
					}
					if (!requiredTagId) {
						unresolved(
							slot.strategy === "tag_random_selected"
								? "Selecciona una etiqueta primero"
								: "Selecciona una etiqueta para este espacio",
						);
						continue;
					}
				}

				const candidates = reviewers.filter((r: any) => {
					if (r.isAbsent) return false;
					if (currentUserReviewerId && String(r._id) === currentUserReviewerId)
						return false;
					if (selectedIds.has(String(r._id))) return false;
					if (requiredTagId && !r.tags.includes(requiredTagId)) return false;
					return true;
				});

				const sorted = [...candidates].sort((a: any, b: any) => {
					const aCount = virtualCounts.get(String(a._id)) ?? a.assignmentCount;
					const bCount = virtualCounts.get(String(b._id)) ?? b.assignmentCount;
					if (aCount !== bCount) return aCount - bCount;
					return a.createdAt - b.createdAt;
				});

				const selected = sorted[0];
				if (!selected) {
					unresolved("No hay candidatos disponibles");
					continue;
				}

				selectedIds.add(String(selected._id));
				virtualCounts.set(
					String(selected._id),
					(virtualCounts.get(String(selected._id)) ??
						selected.assignmentCount) + 1,
				);
				previews.push({
					slotIndex,
					status: "resolved",
					reviewerName: selected.name,
					tagName: requiredTagId
						? (tagNameMap.get(String(requiredTagId)) as string | undefined)
						: undefined,
				});
			}

			return { previews, payloadSlots };
		},
		[reviewers, tags],
	);

	// ── Single assignment ──

	const assignPR = useCallback(
		async (opts: {
			reviewerId: string;
			prUrl: string;
			forced?: boolean;
			tagId?: string;
			actionByReviewerId?: string;
			sendChat?: boolean;
			reviewerName?: string;
			reviewerEmail?: string;
			reviewerChatId?: string;
			assignerName?: string;
			assignerEmail?: string;
			assignerChatId?: string;
		}) => {
			if (!teamSlug) return;

			setStatus("assigning");
			setErrorMessage(null);

			try {
				const result = await assignPRMutation({
					reviewerId: opts.reviewerId as any,
					prUrl: opts.prUrl,
					forced: opts.forced ?? false,
					tagId: opts.tagId as any,
					actionByReviewerId: opts.actionByReviewerId as any,
				});

				if (result?.success && result.reviewer) {
					setLastAssignedName(result.reviewer.name);
					setLastAssignerName(opts.assignerName ?? null);
					setStatus("success");

					if (opts.sendChat && opts.reviewerName && opts.reviewerEmail) {
						try {
							await sendChatAction({
								reviewerName: opts.reviewerName,
								reviewerEmail: opts.reviewerEmail,
								reviewerChatId: opts.reviewerChatId,
								prUrl: opts.prUrl,
								teamSlug,
								assignerName: opts.assignerName,
								assignerEmail: opts.assignerEmail,
								assignerChatId: opts.assignerChatId,
							});
						} catch (chatErr) {
							console.warn("Failed to send chat notification:", chatErr);
						}
					}

					setTimeout(() => {
						setStatus("idle");
						setLastAssignedName(null);
						setLastAssignerName(null);
					}, 3000);
				} else {
					setStatus("error");
					setErrorMessage("La asignación falló");
				}
			} catch (err) {
				setStatus("error");
				setErrorMessage(
					err instanceof Error ? err.message : "La asignación falló",
				);
			}
		},
		[teamSlug, assignPRMutation, sendChatAction],
	);

	// ── Batch assignment with slot configs ──

	const assignPRBatch = useCallback(
		async (opts: {
			mode: AssignmentMode;
			selectedTagId?: string;
			payloadSlots: Array<{
				strategy: SlotStrategy;
				reviewerId?: string;
				tagId?: string;
			}>;
			prUrl: string;
			actionByReviewerId?: string;
			sendChat?: boolean;
			assignerName?: string;
			assignerEmail?: string;
			assignerChatId?: string;
		}) => {
			if (!teamSlug) return;

			setStatus("assigning");
			setErrorMessage(null);

			try {
				const result = await assignPRBatchMutation({
					teamSlug,
					mode: opts.mode,
					selectedTagId:
						opts.mode === "tag" ? (opts.selectedTagId as any) : undefined,
					slots: opts.payloadSlots.map((s) => ({
						strategy: s.strategy,
						reviewerId: s.reviewerId as any,
						tagId: s.tagId as any,
					})),
					prUrl: opts.prUrl,
					actionByReviewerId: opts.actionByReviewerId as any,
				});

				if (result?.success && result.assignedCount > 0) {
					const names = result.assigned.map((a: any) => a.reviewer.name);
					setLastAssignedName(names.join(", "));
					setLastAssignerName(opts.assignerName ?? null);
					setStatus("success");

					// Send Google Chat notification
					if (opts.sendChat && opts.prUrl) {
						try {
							if (result.assignedCount > 1) {
								await sendChatGroupAction({
									reviewers: result.assigned.map((a: any) => {
										const reviewer = reviewers.find(
											(r: any) => String(r._id) === String(a.reviewer.id),
										);
										return {
											name: a.reviewer.name,
											email: a.reviewer.email,
											reviewerChatId: reviewer?.googleChatUserId,
										};
									}),
									prUrl: opts.prUrl,
									teamSlug,
									assignerName: opts.assignerName,
									assignerEmail: opts.assignerEmail,
									assignerChatId: opts.assignerChatId,
								});
							} else if (result.assigned[0]) {
								const first = result.assigned[0];
								const reviewer = reviewers.find(
									(r: any) => String(r._id) === String(first.reviewer.id),
								);
								await sendChatAction({
									reviewerName: first.reviewer.name,
									reviewerEmail: first.reviewer.email,
									reviewerChatId: reviewer?.googleChatUserId,
									prUrl: opts.prUrl,
									teamSlug,
									assignerName: opts.assignerName,
									assignerEmail: opts.assignerEmail,
									assignerChatId: opts.assignerChatId,
								});
							}
						} catch (chatErr) {
							console.warn("Failed to send chat notification:", chatErr);
						}
					}

					setTimeout(() => {
						setStatus("idle");
						setLastAssignedName(null);
						setLastAssignerName(null);
					}, 4000);

					return result;
				}

				setStatus("error");
				setErrorMessage(
					result?.failedCount > 0
						? `${result.failedCount} de ${result.totalRequested} espacios fallaron`
						: "No se pudieron asignar revisores",
				);
				return result;
			} catch (err) {
				setStatus("error");
				setErrorMessage(
					err instanceof Error ? err.message : "La asignación por lote falló",
				);
			}
		},
		[
			teamSlug,
			assignPRBatchMutation,
			sendChatAction,
			sendChatGroupAction,
			reviewers,
		],
	);

	const resetStatus = useCallback(() => {
		setStatus("idle");
		setLastAssignedName(null);
		setLastAssignerName(null);
		setErrorMessage(null);
	}, []);

	return {
		// Data
		teams,
		reviewers,
		availableReviewers,
		tags,
		nextReviewer,
		// Helpers
		findReviewerByEmail,
		getNextReviewerByTag,
		resolveSlotPreview,
		// Actions
		assignPR,
		assignPRBatch,
		resetStatus,
		// State
		status,
		lastAssignedName,
		lastAssignerName,
		errorMessage,
	};
}
