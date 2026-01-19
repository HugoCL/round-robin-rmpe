import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface BackupEntry {
	key: string;
	description: string;
	timestamp: number;
	formattedDate?: string;
}

interface SnapshotDialogProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	snapshots: BackupEntry[];
	isLoading: boolean;
	onRestore: (key: string) => void;
}

/**
 * SnapshotDialog component displays a list of snapshots and allows restoring them.
 * @param {SnapshotDialogProps} props - The props for the component.
 */
export function SnapshotDialog({
	isOpen,
	onOpenChange,
	snapshots,
	isLoading,
	onRestore,
}: SnapshotDialogProps) {
	const t = useTranslations();

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{t("change-history")}</DialogTitle>
					<DialogDescription>
						{t("history.restoreDescription")}
					</DialogDescription>
				</DialogHeader>
				<div className="py-4 max-h-[300px] overflow-y-auto">
					{isLoading ? (
						<div className="text-center py-4">
							<p>{t("common.loading")}</p>
						</div>
					) : snapshots.length === 0 ? (
						<div className="text-center py-4">
							<p>{t("history.noSnapshots")}</p>
							<p className="text-sm text-muted-foreground mt-2">
								{t("history.changesAutoSaved")}
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{snapshots.map((snapshot) => (
								<div
									key={snapshot.key}
									className="flex justify-between items-center p-3 border  hover:bg-muted/50"
								>
									<div>
										<p className="font-medium">{snapshot.formattedDate}</p>
										<p className="text-sm text-muted-foreground">
											{snapshot.description}
										</p>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() => onRestore(snapshot.key)}
									>
										{t("history.restore")}
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
				<DialogFooter />
			</DialogContent>
		</Dialog>
	);
}
