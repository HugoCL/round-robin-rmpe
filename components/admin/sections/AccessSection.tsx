"use client";

import { AdminRosterList } from "./AdminRosterList";
import { EmailPolicyForm } from "./EmailPolicyForm";

export function AccessSection() {
	return (
		<div className="space-y-6">
			<AdminRosterList />
			<EmailPolicyForm />
		</div>
	);
}
