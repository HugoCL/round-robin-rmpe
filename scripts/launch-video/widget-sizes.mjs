import { recordLaunchVideo } from "./recorder.mjs";

await recordLaunchVideo({
	output: "public/changelog/widget-sizes.mp4",
	posterAtSeconds: 9,
	// The three lanes only show from 1536 px.
	viewport: { width: 1536, height: 960 },
	prepare: async ({ page, baseUrl }) => {
		await page.goto(`${baseUrl}/es/onboarding`);
		await page.getByRole("combobox").click();
		await page.getByRole("option", { name: "Demo Plataforma" }).click();
		await page.getByRole("button", { name: "Unirme al equipo" }).click();
		await page.waitForURL(`${baseUrl}/es/demo-plataforma`);
		await page.locator('[data-widget="rotation"] li').first().waitFor();
		await page
			.locator("[data-launch-spotlight]")
			.getByRole("button", { name: "Descartar" })
			.click({ timeout: 5000 })
			.catch(() => {});
		// A take starts from the default view, whatever the last one left saved.
		await page.getByRole("button", { name: "Personalizar" }).click();
		const reset = page.getByRole("button", { name: "Restablecer vista" });
		if (await reset.isEnabled()) await reset.click();
		await page.getByRole("button", { name: "Listo" }).click();
		await page.getByRole("button", { name: "Personalizar" }).waitFor();
	},
	scenario: async ({
		page,
		clickOn,
		dragTo,
		zoomOn,
		caption,
		wait,
		startCapture,
	}) => {
		const widget = (id) => page.locator(`[data-widget="${id}"]`);
		const size = (name, label) =>
			page
				.getByRole("group", { name: `Tamaño de ${name}` })
				.getByRole("button", { name: label });

		await page.reload();
		await widget("rotation").locator("li").first().waitFor();
		await widget("events").getByRole("button").first().waitFor();
		// The birthday notice is not part of the feature and pushes it down.
		const notice = page
			.getByText(/Hoy cumple años/)
			.locator("xpath=ancestor::*[.//button][1]")
			.getByRole("button");
		if ((await notice.count()) > 0) await notice.click();
		await wait(800);
		await startCapture();
		await wait(300);
		caption("Ahora cada widget tiene tamaños");
		await wait(2200);

		await clickOn(page.getByRole("button", { name: "Personalizar" }));
		await page.getByRole("button", { name: "Listo" }).waitFor();
		await wait(900);

		await zoomOn(widget("rotation"), 1.4);
		await wait(900);
		caption("Compacto deja lo esencial");
		await clickOn(size("Rotación", "Compacto"));
		await wait(1500);
		await clickOn(size("Ausencias", "Compacto"));
		await wait(2000);

		caption("Y Amplio muestra más");
		await clickOn(size("Ausencias", "Amplio"));
		await wait(2400);

		await zoomOn();
		await wait(600);
		caption("La tarjeta de asignación también se mueve");
		await dragTo(widget("assignment"), widget("rotation"));
		await wait(2400);

		await clickOn(page.getByRole("button", { name: "Listo" }), 800);
		caption("Tu vista queda guardada y es solo tuya");
		await wait(3200);
	},
});
