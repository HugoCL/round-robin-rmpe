import { recordLaunchVideo } from "./recorder.mjs";

await recordLaunchVideo({
	output: "public/changelog/custom-view.mp4",
	posterAtSeconds: 3,
	// The three lanes only show from 1536 px.
	viewport: { width: 1536, height: 960 },
	prepare: async ({ page, baseUrl }) => {
		await page.goto(`${baseUrl}/es/onboarding`);
		await page.getByRole("combobox").click();
		await page.getByRole("option", { name: "Demo Plataforma" }).click();
		await page.getByRole("button", { name: "Unirme al equipo" }).click();
		await page.waitForURL(`${baseUrl}/es/demo-plataforma`);
		await page.locator('[data-widget="rotation"] li').first().waitFor();
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
		caption("La lista ahora usa todo el ancho de tu pantalla");
		await wait(2800);

		await clickOn(page.getByRole("button", { name: "Personalizar" }));
		await page.getByRole("button", { name: "Listo" }).waitFor();
		caption("Con Personalizar armas tu propia vista");
		await wait(1900);

		await zoomOn(widget("events"), 1.4);
		await wait(1100);
		caption("Arrastra un widget a donde lo quieras");
		await dragTo(widget("events"), widget("absences"));
		await wait(1900);

		const add = page.getByRole("button", { name: "Agregar Carga del equipo" });
		// Up to the bar: the widgets to add sit there, and the new one lands under it.
		await zoomOn(widget("myWeek"), 1.4);
		await wait(700);
		caption("Agrega los que te sirvan");
		await clickOn(add);
		await widget("teamLoad").waitFor();
		await wait(2300);

		caption("Y quita los que no usas");
		await clickOn(page.getByRole("button", { name: "Quitar Mis revisiones" }));
		await wait(2000);

		await zoomOn();
		await clickOn(page.getByRole("button", { name: "Listo" }), 800);
		caption("Tu vista queda guardada y es solo tuya");
		await wait(3200);
	},
});
