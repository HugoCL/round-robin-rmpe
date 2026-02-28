// Detect system dark mode preference and apply .dark class
// This is a separate file because Chrome Extension CSP blocks inline scripts.
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
	document.documentElement.classList.add("dark");
}
window
	.matchMedia("(prefers-color-scheme: dark)")
	.addEventListener("change", (e) => {
		document.documentElement.classList.toggle("dark", e.matches);
	});
