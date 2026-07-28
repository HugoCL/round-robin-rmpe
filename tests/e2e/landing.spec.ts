import { expect, test } from "@playwright/test";

test("keeps the public team switcher usable on mobile", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/es");

	await expect(
		page.getByRole("heading", { level: 1, name: "Selecciona un equipo" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Crear equipo" })).toBeVisible();
	await expect(page.locator("main")).toBeVisible();

	const viewport = await page
		.locator('meta[name="viewport"]')
		.getAttribute("content");
	expect(viewport).not.toContain("maximum-scale=1");
	expect(viewport).not.toContain("user-scalable=no");

	const hasHorizontalOverflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);
	expect(hasHorizontalOverflow).toBe(false);
});

test("removes decorative motion when reduced motion is requested", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/es");

	await expect(page.locator(".page-enter-soft")).toHaveCSS(
		"animation-name",
		"none",
	);
});
