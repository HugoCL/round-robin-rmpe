"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import type { Reviewer } from "@/lib/types";

declare global {
	interface Window {
		webkitAudioContext?: typeof AudioContext;
	}
}

type AssignmentFeedItem = {
	reviewerId: string;
	timestamp: number;
	skipped?: boolean;
	isAbsentSkip?: boolean;
};

type UseAssignmentNotificationAudioInput = {
	assignmentItems?: AssignmentFeedItem[];
	reviewers: Reviewer[];
	userEmail?: string;
};

export function useAssignmentNotificationAudio({
	assignmentItems,
	reviewers,
	userEmail,
}: UseAssignmentNotificationAudioInput) {
	const t = useTranslations();
	const lastProcessedAssignmentRef = useRef<string | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);

	useEffect(() => {
		const ensureAudioContext = async () => {
			try {
				if (!audioCtxRef.current) {
					const Ctx: typeof AudioContext | undefined =
						window.AudioContext || window.webkitAudioContext;
					if (!Ctx) return;
					audioCtxRef.current = new Ctx();
				}
				if (audioCtxRef.current.state === "suspended") {
					await audioCtxRef.current.resume();
				}
			} catch {
				// Ignore autoplay restrictions until a supported interaction occurs.
			}
		};

		const onFirstInteraction = () => {
			void ensureAudioContext();
			window.removeEventListener("pointerdown", onFirstInteraction);
			window.removeEventListener("keydown", onFirstInteraction);
		};

		window.addEventListener("pointerdown", onFirstInteraction, { once: true });
		window.addEventListener("keydown", onFirstInteraction, { once: true });

		return () => {
			window.removeEventListener("pointerdown", onFirstInteraction);
			window.removeEventListener("keydown", onFirstInteraction);
		};
	}, []);

	const playMelody = useCallback(async () => {
		try {
			if (!audioCtxRef.current) {
				const Ctx: typeof AudioContext | undefined =
					window.AudioContext || window.webkitAudioContext;
				if (!Ctx) return;
				audioCtxRef.current = new Ctx();
			}
			const context = audioCtxRef.current;
			if (context.state === "suspended") {
				await context.resume();
			}

			const sequence: Array<{ f: number; d: number }> = [
				{ f: 880, d: 0.18 },
				{ f: 1108.73, d: 0.18 },
				{ f: 1318.51, d: 0.24 },
			];

			const startAt = context.currentTime;
			let when = startAt;
			const gap = 0.03;

			const scheduleTone = (
				frequency: number,
				start: number,
				duration: number,
			) => {
				const osc = context.createOscillator();
				const gain = context.createGain();
				osc.type = "sine";
				osc.frequency.value = frequency;
				const baseVol = 0.05;
				gain.gain.setValueAtTime(0, start);
				gain.gain.linearRampToValueAtTime(baseVol, start + 0.01);
				gain.gain.linearRampToValueAtTime(
					baseVol * 0.8,
					start + duration * 0.6,
				);
				gain.gain.linearRampToValueAtTime(0.0001, start + duration);
				osc.connect(gain);
				gain.connect(context.destination);
				osc.start(start);
				osc.stop(start + duration + 0.005);
				osc.onended = () => {
					try {
						osc.disconnect();
						gain.disconnect();
					} catch {
						// No-op cleanup.
					}
				};
			};

			for (const note of sequence) {
				scheduleTone(note.f, when, note.d);
				when += note.d + gap;
			}
		} catch {
			toast({
				title: t("pr.reviewAssignedToYou"),
				description: t("pr.youAreNextReviewer"),
			});
		}
	}, [t]);

	useEffect(() => {
		if (!assignmentItems || assignmentItems.length === 0) return;
		if (!userEmail) return;

		const newest = assignmentItems[0];
		const key = `${newest.reviewerId}-${newest.timestamp}`;

		if (lastProcessedAssignmentRef.current === null) {
			lastProcessedAssignmentRef.current = key;
			return;
		}

		if (lastProcessedAssignmentRef.current === key) return;
		lastProcessedAssignmentRef.current = key;

		if (newest.skipped || newest.isAbsentSkip) return;

		const assignedReviewer = reviewers.find(
			(reviewer) => String(reviewer._id) === String(newest.reviewerId),
		);
		const assignedEmail = assignedReviewer?.email?.toLowerCase();
		const currentEmail = userEmail.toLowerCase();

		if (assignedEmail && assignedEmail === currentEmail) {
			void playMelody();
		}
	}, [assignmentItems, playMelody, reviewers, userEmail]);
}
