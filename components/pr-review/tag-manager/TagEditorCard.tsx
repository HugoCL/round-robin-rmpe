import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_COLORS } from "./useTagManagerController";

type TagEditorCardProps = {
	isEditing: boolean;
	tagName: string;
	tagColor: string;
	tagDescription: string;
	loading: boolean;
	onTagNameChange: (value: string) => void;
	onTagColorChange: (value: string) => void;
	onTagDescriptionChange: (value: string) => void;
	onSubmit: () => Promise<void>;
	onCancelEditing: () => void;
};

export function TagEditorCard({
	isEditing,
	tagName,
	tagColor,
	tagDescription,
	loading,
	onTagNameChange,
	onTagColorChange,
	onTagDescriptionChange,
	onSubmit,
	onCancelEditing,
}: TagEditorCardProps) {
	const t = useTranslations();
	const tagNameId = useId();
	const tagDescriptionId = useId();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">
					{isEditing ? t("tags.editTag") : t("tags.addNewTag")}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<Label htmlFor={tagNameId}>{t("tags.tagName")}</Label>
						<Input
							id={tagNameId}
							value={tagName}
							onChange={(event) => onTagNameChange(event.target.value)}
							placeholder={t("tags.tagPlaceholder")}
						/>
					</div>
					<div>
						<Label htmlFor="tagColor">{t("common.color")}</Label>
						<div className="flex items-center gap-2">
							<Select value={tagColor} onValueChange={onTagColorChange}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DEFAULT_COLORS.map((color) => (
										<SelectItem key={color} value={color}>
											<div className="flex items-center gap-2">
												<div
													className="w-4 h-4"
													style={{ backgroundColor: color }}
												/>
												{color}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div
								className="w-8 h-8 border"
								style={{ backgroundColor: tagColor }}
							/>
						</div>
					</div>
				</div>
				<div>
					<Label htmlFor={tagDescriptionId}>
						{t("tags.description")} ({t("common.optional")})
					</Label>
					<Textarea
						id={tagDescriptionId}
						value={tagDescription}
						onChange={(event) => onTagDescriptionChange(event.target.value)}
						placeholder={t("tags.descriptionPlaceholder")}
						rows={2}
					/>
				</div>
				<div className="flex gap-2">
					<Button onClick={() => void onSubmit()} disabled={loading}>
						{isEditing ? t("tags.updateTag") : t("tags.addTag")}
					</Button>
					{isEditing && (
						<Button variant="outline" onClick={onCancelEditing}>
							{t("common.cancel")}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
