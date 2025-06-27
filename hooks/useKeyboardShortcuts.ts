import { useEffect } from "react"

interface KeyboardShortcutsProps {
    onAssignPR: () => Promise<void>
    onSkipReviewer: () => Promise<void>
    onUndoAssignment: () => Promise<void>
    onRefresh: () => void
    isNextReviewerAvailable: boolean
}

export function useKeyboardShortcuts({
    onAssignPR,
    onSkipReviewer,
    onUndoAssignment,
    onRefresh,
    isNextReviewerAvailable,
}: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
            const isCtrlOrCmd = event.ctrlKey || event.metaKey

            if (!isCtrlOrCmd) return

            // Prevent default browser behavior for our shortcuts
            switch (event.key.toLowerCase()) {
                case "a":
                    if (isNextReviewerAvailable) {
                        event.preventDefault()
                        onAssignPR()
                    }
                    break
                case "s":
                    if (isNextReviewerAvailable) {
                        event.preventDefault()
                        onSkipReviewer()
                    }
                    break
                case "z":
                    event.preventDefault()
                    onUndoAssignment()
                    break
                case "r":
                    event.preventDefault()
                    onRefresh()
                    break
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [onAssignPR, onSkipReviewer, onUndoAssignment, onRefresh, isNextReviewerAvailable])
}
