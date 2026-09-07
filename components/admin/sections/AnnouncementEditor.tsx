"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";

type TeamOption = { _id: Id<"teams">; name: string; slug: string };
type AnnouncementRow = Doc<"announcements"> & { isBuiltIn: boolean };

/** Converts an epoch to the value a datetime-local input expects, in local time. */
function toLocalInputValue(value: number | undefined): string {
	if (value === undefined) return "";
	const date = new Date(value - new Date(value).getTimezoneOffset() * 60000);
	return date.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): number | undefined {
	if (!value) return undefined;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function AnnouncementEditor({
	open,
	announcement,
	teams,
	onOpenChange,
}: {
	open: boolean;
	announcement: AnnouncementRow | null;
	teams: TeamOption[];
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();
	const isMobile = useIsMobile();

	const keyId = useId();
	const bodyEsId = useId();
	const bodyEnId = useId();
	const linkId = useId();
	const startsId = useId();
	const endsId = useId();

	const createAnnouncement = useMutation(api.announcements.createAnnouncement);
	const updateAnnouncement = useMutation(api.announcements.updateAnnouncement);

	const [key, setKey] = useState("");
	const [status, setStatus] = useState<"draft" | "published" | "archived">(
		"draft",
	);
	const [variant, setVariant] = useState<"default" | "destructive">("default");
	const [bodyEs, setBodyEs] = useState("");
	const [bodyEn, setBodyEn] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [audience, setAudience] = useState<"everyone" | "admins" | "teams">(
		"everyone",
	);
	const [teamIds, setTeamIds] = useState<Id<"teams">[]>([]);
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// Reset from the row every time the dialog opens, so a cancelled edit does
	// not leak into the next one.
	useEffect(() => {
		if (!open) return;
		setKey(announcement?.key ?? "");
		setStatus(announcement?.status ?? "draft");
		setVariant(announcement?.variant ?? "default");
		setBodyEs(announcement?.bodyEs ?? "");
		setBodyEn(announcement?.bodyEn ?? "");
		setLinkUrl(announcement?.linkUrl ?? "");
		setAudience(announcement?.audience ?? "everyone");
		setTeamIds(announcement?.teamIds ?? []);
		setStartsAt(toLocalInputValue(announcement?.startsAt));
		setEndsAt(toLocalInputValue(announcement?.endsAt));
		setIsSaving(false);
	}, [open, announcement]);

	const isBuiltIn = announcement?.isBuiltIn === true;
	const canSubmit =
		key.trim().length > 0 &&
		(isBuiltIn || bodyEs.trim().length > 0 || bodyEn.trim().length > 0) &&
		(audience !== "teams" || teamIds.length > 0) &&
		!isSaving;

	const handleSave = async () => {
		if (!canSubmit) return;
		setIsSaving(true);
		const payload = {
			key: key.trim(),
			status,
			variant,
			bodyEs: bodyEs.trim() || undefined,
			bodyEn: bodyEn.trim() || undefined,
			linkUrl: linkUrl.trim() || undefined,
			audience,
			teamIds: audience === "teams" ? teamIds : undefined,
			requiresTeamEvents: announcement?.requiresTeamEvents,
			startsAt: fromLocalInputValue(startsAt),
			endsAt: fromLocalInputValue(endsAt),
			dismissible: announcement?.dismissible ?? true,
			order: announcement?.order,
		};
		try {
			if (announcement) {
				await updateAnnouncement({ id: announcement._id, ...payload });
			} else {
				await createAnnouncement(payload);
			}
			toast({ title: t("announcements.saved") });
			onOpenChange(false);
		} catch (error) {
			showError(error);
		} finally {
			setIsSaving(false);
		}
	};

	const body = (
		<div className="space-y-4 px-4 pb-2 sm:px-0">
			<div className="space-y-1.5">
				<label
					htmlFor={keyId}
					className="text-sm font-medium text-muted-foreground"
				>
					{t("announcements.keyLabel")}
				</label>
				<Input
					id={keyId}
					value={key}
					className="font-mono"
					placeholder="nueva-funcion-v1"
					onChange={(event) => setKey(event.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					{t("announcements.keyHint")}
				</p>
			</div>

			{isBuiltIn ? (
				<p className="text-xs text-muted-foreground">
					{t("announcements.builtInHint")}
				</p>
			) : (
				<>
					<div className="space-y-1.5">
						<label
							htmlFor={bodyEsId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("announcements.bodyEsLabel")}
						</label>
						<Textarea
							id={bodyEsId}
							rows={3}
							value={bodyEs}
							onChange={(event) => setBodyEs(event.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<label
							htmlFor={bodyEnId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("announcements.bodyEnLabel")}
						</label>
						<Textarea
							id={bodyEnId}
							rows={3}
							value={bodyEn}
							onChange={(event) => setBodyEn(event.target.value)}
						/>
					</div>
				</>
			)}

			<div className="space-y-1.5">
				<label
					htmlFor={linkId}
					className="text-sm font-medium text-muted-foreground"
				>
					{t("announcements.linkLabel")}
				</label>
				<Input
					id={linkId}
					type="url"
					value={linkUrl}
					placeholder="https://example.com"
					onChange={(event) => setLinkUrl(event.target.value)}
				/>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1.5">
					<span className="text-sm font-medium text-muted-foreground">
						{t("announcements.statusLabel")}
					</span>
					<Select
						value={status}
						onValueChange={(value) =>
							setStatus(value as "draft" | "published" | "archived")
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="draft">
								{t("announcements.status.draft")}
							</SelectItem>
							<SelectItem value="published">
								{t("announcements.status.published")}
							</SelectItem>
							<SelectItem value="archived">
								{t("announcements.status.archived")}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<span className="text-sm font-medium text-muted-foreground">
						{t("announcements.audienceLabel")}
					</span>
					<Select
						value={audience}
						onValueChange={(value) =>
							setAudience(value as "everyone" | "admins" | "teams")
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="everyone">
								{t("announcements.audience.everyone")}
							</SelectItem>
							<SelectItem value="admins">
								{t("announcements.audience.admins")}
							</SelectItem>
							<SelectItem value="teams">
								{t("announcements.audience.teams")}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{audience === "teams" ? (
				<div className="space-y-2">
					<span className="text-sm font-medium text-muted-foreground">
						{t("announcements.teamsLabel")}
					</span>
					<ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">
						{teams.map((team) => (
							<li key={team._id} className="flex items-center gap-2 px-1 py-1">
								<Checkbox
									id={`team-${team._id}`}
									checked={teamIds.includes(team._id)}
									onCheckedChange={(checked) =>
										setTeamIds((prev) =>
											checked
												? [...prev, team._id]
												: prev.filter((id) => id !== team._id),
										)
									}
								/>
								<label htmlFor={`team-${team._id}`} className="text-sm">
									{team.name}
								</label>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label
						htmlFor={startsId}
						className="text-sm font-medium text-muted-foreground"
					>
						{t("announcements.startsAtLabel")}
					</label>
					<Input
						id={startsId}
						type="datetime-local"
						value={startsAt}
						onChange={(event) => setStartsAt(event.target.value)}
					/>
				</div>
				<div className="space-y-1.5">
					<label
						htmlFor={endsId}
						className="text-sm font-medium text-muted-foreground"
					>
						{t("announcements.endsAtLabel")}
					</label>
					<Input
						id={endsId}
						type="datetime-local"
						value={endsAt}
						onChange={(event) => setEndsAt(event.target.value)}
					/>
				</div>
			</div>

			<div className="space-y-1.5">
				<span className="text-sm font-medium text-muted-foreground">
					{t("announcements.variantLabel")}
				</span>
				<Select
					value={variant}
					onValueChange={(value) =>
						setVariant(value as "default" | "destructive")
					}
				>
					<SelectTrigger className="w-full sm:w-60">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="default">
							{t("announcements.variantDefault")}
						</SelectItem>
						<SelectItem value="destructive">
							{t("announcements.variantDestructive")}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);

	const title = announcement
		? t("announcements.editTitle")
		: t("announcements.createTitle");
	const description = t("announcements.editorDescription");
	const footer = (
		<>
			<Button
				type="button"
				variant="outline"
				onClick={() => onOpenChange(false)}
			>
				{tCommon("common.cancel")}
			</Button>
			<Button
				type="button"
				disabled={!canSubmit}
				onClick={() => void handleSave()}
			>
				{isSaving ? tCommon("common.saving") : tCommon("common.save")}
			</Button>
		</>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent className="max-h-[90vh] overflow-y-auto">
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					{body}
					<DrawerFooter>{footer}</DrawerFooter>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{body}
				<DialogFooter>{footer}</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
