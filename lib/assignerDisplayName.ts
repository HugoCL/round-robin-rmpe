type ResolveAssignerDisplayNameInput = {
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	fullName?: string | null;
	reviewerName?: string | null;
};

function isEmailLike(value: string) {
	return value.includes("@");
}

export function resolveAssignerDisplayName(
	input: ResolveAssignerDisplayNameInput,
): string {
	const reviewerName = input.reviewerName?.trim();
	if (reviewerName) return reviewerName;

	const firstName = input.firstName?.trim();
	const lastName = input.lastName?.trim();
	if (firstName && lastName) return `${firstName} ${lastName}`;

	const fullName = input.fullName?.trim();
	if (fullName) return fullName;

	if (firstName && !isEmailLike(firstName)) return firstName;
	if (lastName && !isEmailLike(lastName)) return lastName;

	return "Unknown";
}
