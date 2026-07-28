const BUK_EMAIL = /^.+@buk\.[a-z0-9-]+$/i;
const CLERK_TEST_EMAIL_SUFFIX = "+clerk_test@example.com";

export function isAllowedAppEmail(
	email: string | null | undefined,
	allowClerkTestEmails = false,
): boolean {
	const normalized = email?.trim().toLowerCase();
	if (!normalized) return false;
	return (
		BUK_EMAIL.test(normalized) ||
		(allowClerkTestEmails &&
			normalized.endsWith(CLERK_TEST_EMAIL_SUFFIX) &&
			normalized.length > CLERK_TEST_EMAIL_SUFFIX.length)
	);
}
