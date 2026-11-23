import { recordLaunchVideo } from "./recorder.mjs";

await recordLaunchVideo({
	output: "public/changelog/multi-team-membership.mp4",
	posterAtSeconds: 6,
	prepare: async ({ page, baseUrl }) => {
		await page.goto(`${baseUrl}/es/onboarding`);
		await page.getByRole("combobox").click();
		await page.getByRole("option", { name: "Demo Plataforma" }).click();
		await page.getByRole("button", { name: "Unirme al equipo" }).click();
		await page.waitForURL(`${baseUrl}/es/demo-plataforma`);
		await page.getByRole("button", { name: /Disponible/ }).waitFor();
	},
	scenario: async ({ page, baseUrl, clickOn, caption, wait, startCapture }) => {
		const switcher = page.locator('button[aria-label*="Cambiar de equipo"]');

		await page.reload();
		await page.getByRole("button", { name: /Disponible/ }).waitFor();
		await wait(600);
		await startCapture();
		await wait(300);
		caption("Ahora puedes ser parte de más de un equipo");
		await wait(2400);

		await clickOn(switcher);
		await page.getByRole("menu").waitFor();
		caption("Tus equipos aparecen primero");
		await wait(2400);

		await clickOn(page.getByRole("menuitemradio", { name: "Demo Pagos" }), 550);
		await page.waitForURL(`${baseUrl}/es/demo-pagos`);
		const join = page.getByRole("button", { name: "Unirme al equipo" });
		await join.waitFor();
		caption("Entra a otro equipo y únete ahí mismo");
		await wait(1700);

		await clickOn(join);
		await page.getByRole("dialog", { name: "Unirte a Demo Pagos" }).waitFor();
		await wait(2200);
		await clickOn(
			page.getByRole("button", { name: "Unirme", exact: true }),
			520,
		);
		await page.getByRole("button", { name: /Disponible/ }).waitFor();
		caption("Listo, ya estás en su rotación");
		await wait(2600);

		await clickOn(switcher);
		await page.getByRole("menu").waitFor();
		caption("Y cambias entre tus equipos cuando quieras");
		await wait(3200);
	},
});
