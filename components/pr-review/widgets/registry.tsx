import type { ComponentType } from "react";
import type { WidgetId } from "@/lib/widgetLayout";
import { FeedHistory } from "../FeedHistory";
import { AbsencesWidget } from "./AbsencesWidget";
import { AssignmentWidget } from "./AssignmentWidget";
import { BirthdaysWidget } from "./BirthdaysWidget";
import { EventsWidget } from "./EventsWidget";
import { MyReviewsWidget } from "./MyReviewsWidget";
import { MyWeekWidget } from "./MyWeekWidget";
import { OtherTeamsWidget } from "./OtherTeamsWidget";
import { RotationWidget } from "./RotationWidget";
import { TagsWidget } from "./TagsWidget";
import { TeamLoadWidget } from "./TeamLoadWidget";

/** Everything a lane can hold. Each widget renders its own `WidgetFrame`; the assignment card keeps its own surface. */
export const WIDGETS: Record<WidgetId, ComponentType> = {
	assignment: AssignmentWidget,
	history: FeedHistory,
	rotation: RotationWidget,
	myWeek: MyWeekWidget,
	absences: AbsencesWidget,
	events: EventsWidget,
	myReviews: MyReviewsWidget,
	teamLoad: TeamLoadWidget,
	tags: TagsWidget,
	birthdays: BirthdaysWidget,
	otherTeams: OtherTeamsWidget,
};
