import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORT = { width: 864, height: 540 };
const CAPTION_STRIP = 64;
const SCALE = 2;
/**
 * A full-resolution frame takes ~75 ms to capture, so the session runs this
 * many times slower than the final video and every timestamp is compressed
 * back. CSS animations are slowed by the same factor to stay in sync.
 */
const SLOWDOWN = 2.5;
const FPS = 30;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const pointerOverlay = () => {
	const install = () => {
		if (document.getElementById("launch-video-overlay")) return;
		const root = document.createElement("div");
		root.id = "launch-video-overlay";
		root.innerHTML = `
<style>
  nextjs-portal { display: none !important; }
  #launch-video-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647;
    pointer-events: none; width: 22px; height: 22px; }
  #launch-video-ripple { position: fixed; left: 0; top: 0; z-index: 2147483646;
    pointer-events: none; width: 34px; height: 34px; margin: -17px 0 0 -17px;
    border-radius: 9999px; background: oklch(0.52 0.19 258 / 0.28); opacity: 0; }
  #launch-video-ripple.on { animation: launch-video-ripple 420ms cubic-bezier(0.22, 1, 0.36, 1); }
  @keyframes launch-video-ripple {
    from { opacity: 1; transform: translate(var(--x), var(--y)) scale(0.4); }
    to { opacity: 0; transform: translate(var(--x), var(--y)) scale(1.25); } }
</style>
<div id="launch-video-ripple"></div>
<svg id="launch-video-cursor" viewBox="0 0 22 22" fill="none"><path d="M4 2.5v15.2l4.1-3.6 2.7 6 2.6-1.1-2.7-6 5.4-.4L4 2.5Z" fill="#111827" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
		document.documentElement.appendChild(root);
		const cursor = root.querySelector("#launch-video-cursor");
		const ripple = root.querySelector("#launch-video-ripple");
		let x = 0;
		let y = 0;
		window.addEventListener(
			"mousemove",
			(event) => {
				x = event.clientX;
				y = event.clientY;
				cursor.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
			},
			true,
		);
		window.addEventListener(
			"mousedown",
			() => {
				ripple.style.setProperty("--x", `${x}px`);
				ripple.style.setProperty("--y", `${y}px`);
				ripple.classList.remove("on");
				void ripple.offsetWidth;
				ripple.classList.add("on");
			},
			true,
		);
	};
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", install);
	} else {
		install();
	}
};

const LOCAL_BACKEND_STATE = ".convex/local/default/config.json";

/**
 * Launch videos show seeded demo teams only, and recording one writes to the
 * backend. The backend comes from the state `convex dev` keeps for this
 * checkout's local deployment, never from the environment, where a deploy key
 * or a cloud URL would point the same commands somewhere else.
 */
function localBackend() {
	let state;
	try {
		state = JSON.parse(readFileSync(LOCAL_BACKEND_STATE, "utf8"));
	} catch {
		throw new Error(
			`No local Convex backend in ${LOCAL_BACKEND_STATE}. See AGENTS.md.`,
		);
	}
	return {
		url: `http://127.0.0.1:${state.ports.cloud}`,
		adminKey: state.adminKey,
	};
}

/** `--url` with `--admin-key` makes the CLI skip every deployment variable. */
function seedDemoTeams(backend) {
	execFileSync(
		"pnpm",
		[
			"exec",
			"convex",
			"run",
			"seed:seed",
			"{}",
			"--url",
			backend.url,
			"--admin-key",
			backend.adminKey,
		],
		{ stdio: "ignore" },
	);
}

/**
 * The app runs as its own process with its own Convex URL, so the recording
 * browser gets no route to any backend other than the seeded local one.
 */
async function allowOnlyLocalBackend(context, { baseUrl, backend }) {
	const app = new URL(baseUrl);
	const convex = new URL(backend.url);
	const refuse = (url) => {
		console.error(
			`The app at ${baseUrl} reached ${url}, not the local Convex backend at ${backend.url}. Start it with the .env.local that \`convex dev\` wrote.`,
		);
		process.exit(1);
	};
	await context.routeWebSocket(
		(url) =>
			url.host !== app.host &&
			!(LOOPBACK_HOSTS.has(url.hostname) && url.port === convex.port),
		(socket) => refuse(socket.url()),
	);
	await context.route(
		(url) => /\.convex\.(cloud|site)$/.test(url.hostname),
		(route) => refuse(route.request().url()),
	);
}

/** Signs in the Clerk test user without the hosted sign-in form. */
async function signIn(page, baseUrl) {
	const email = process.env.LAUNCH_VIDEO_EMAIL ?? "";
	if (!email.includes("+clerk_test@")) {
		throw new Error(
			"Set LAUNCH_VIDEO_EMAIL to a Clerk test user (a +clerk_test address). Its profile name appears in the video.",
		);
	}
	const clerk = async (path, init) => {
		const response = await fetch(`https://api.clerk.com/v1${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
		});
		if (!response.ok) {
			throw new Error(`Clerk ${path} answered ${response.status}`);
		}
		return response.json();
	};
	const users = await clerk(
		`/users?email_address=${encodeURIComponent(email)}`,
	);
	if (users.length !== 1) {
		throw new Error(
			`Expected one Clerk user for ${email}, got ${users.length}`,
		);
	}
	const { token } = await clerk("/sign_in_tokens", {
		method: "POST",
		body: JSON.stringify({ user_id: users[0].id, expires_in_seconds: 120 }),
	});
	await page.goto(`${baseUrl}/es/sign-in?__clerk_ticket=${token}`);
	await page.waitForURL((url) => !url.pathname.includes("sign-in"));
}

/**
 * Records `scenario` into an MP4 with burned-in captions and a poster frame.
 *
 * Seeds the demo teams and signs in the test user first. `prepare` then runs
 * off camera in the same context. `scenario` gets `clickOn(locator)` to move
 * the visible pointer and click, `caption(text)` to change the line under the
 * app, and `wait(ms)` in video time.
 */
export async function recordLaunchVideo({
	output,
	posterAtSeconds,
	prepare,
	scenario,
}) {
	const baseUrl = `http://localhost:${process.env.E2E_PORT ?? "3000"}`;
	const backend = localBackend();
	seedDemoTeams(backend);

	const workDir = mkdtempSync(join(tmpdir(), "launch-video-"));
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
	});
	await allowOnlyLocalBackend(context, { baseUrl, backend });
	const page = await context.newPage();
	await signIn(page, baseUrl);
	await prepare({ page, baseUrl });
	await context.addInitScript(pointerOverlay);

	const now = () => Date.now() / 1000 / SLOWDOWN;
	const wait = (ms) => page.waitForTimeout(ms * SLOWDOWN);

	const captions = [];
	const caption = (text) => {
		const at = now();
		const last = captions.at(-1);
		if (last && last.end === undefined) last.end = at;
		if (text) captions.push({ text, start: at });
	};

	let pointer = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
	const clickOn = async (locator, travelMs = 650) => {
		await locator.waitFor();
		const box = await locator.boundingBox();
		const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		const steps = Math.round((travelMs * SLOWDOWN) / 16);
		for (let step = 1; step <= steps; step++) {
			const t = step / steps;
			const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
			await page.mouse.move(
				pointer.x + (target.x - pointer.x) * eased,
				pointer.y + (target.y - pointer.y) * eased,
			);
			await page.waitForTimeout(14);
		}
		pointer = target;
		await wait(260);
		await page.mouse.down();
		await wait(80);
		await page.mouse.up();
	};

	const frames = [];
	let capturing = false;
	let captureLoop;
	const startCapture = async () => {
		await page.mouse.move(pointer.x, pointer.y);
		const cdp = await context.newCDPSession(page);
		await cdp.send("Animation.enable");
		await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOWDOWN });
		capturing = true;
		captureLoop = (async () => {
			while (capturing) {
				const at = now();
				const { data } = await cdp.send("Page.captureScreenshot", {
					format: "jpeg",
					quality: 92,
					optimizeForSpeed: true,
					clip: { x: 0, y: 0, ...VIEWPORT, scale: SCALE },
				});
				const file = join(workDir, `frame-${frames.length}.jpg`);
				writeFileSync(file, Buffer.from(data, "base64"));
				frames.push({ file, at });
			}
		})();
	};

	await scenario({ page, baseUrl, clickOn, caption, wait, startCapture });
	caption("");
	capturing = false;
	await captureLoop;
	const endedAt = now();

	const fontFamily = await page.evaluate(
		() => getComputedStyle(document.querySelector("h1")).fontFamily,
	);
	const captionFiles = [];
	for (const [index, { text }] of captions.entries()) {
		await page.evaluate(
			({ text, fontFamily, height }) => {
				document.getElementById("launch-video-caption")?.remove();
				const strip = document.createElement("div");
				strip.id = "launch-video-caption";
				strip.textContent = text;
				strip.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:${height}px;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:oklch(0.19 0.02 258);color:oklch(0.985 0.004 258);font:600 21px/1 ${fontFamily};letter-spacing:-0.02em;`;
				document.documentElement.appendChild(strip);
			},
			{ text, fontFamily, height: CAPTION_STRIP },
		);
		const file = join(workDir, `caption-${index}.png`);
		await page.locator("#launch-video-caption").screenshot({ path: file });
		captionFiles.push(file);
	}
	await browser.close();

	const startedAt = frames[0].at;
	const total = endedAt - startedAt;
	const concat = ["ffconcat version 1.0"];
	frames.forEach((frame, index) => {
		const next = frames[index + 1]?.at ?? endedAt;
		concat.push(
			`file '${frame.file}'`,
			`duration ${Math.max(next - frame.at, 0.001).toFixed(4)}`,
		);
	});
	concat.push(`file '${frames.at(-1).file}'`);
	const concatFile = join(workDir, "frames.ffconcat");
	writeFileSync(concatFile, concat.join("\n"));

	const width = VIEWPORT.width * SCALE;
	const height = VIEWPORT.height * SCALE;
	const inputs = ["-f", "concat", "-safe", "0", "-i", concatFile];
	const filters = [
		`[0:v]fps=${FPS},scale=in_range=full:out_range=tv,pad=${width}:${height + CAPTION_STRIP * SCALE}:0:0:color=0x14161f[v0]`,
	];
	captions.forEach((item, index) => {
		const start = (item.start - startedAt).toFixed(2);
		const end = ((item.end ?? endedAt) - startedAt).toFixed(2);
		inputs.push(
			"-loop",
			"1",
			"-framerate",
			String(FPS),
			"-t",
			total.toFixed(2),
			"-i",
			captionFiles[index],
		);
		filters.push(
			`[${index + 1}:v]format=rgba,fade=t=in:st=${start}:d=0.3:alpha=1,fade=t=out:st=${(end - 0.3).toFixed(2)}:d=0.3:alpha=1[c${index}]`,
			`[v${index}][c${index}]overlay=0:${height}:enable='between(t,${start},${end})'[v${index + 1}]`,
		);
	});

	mkdirSync(dirname(output), { recursive: true });
	const ffmpeg = (args) =>
		execFileSync("ffmpeg", ["-y", "-v", "error", ...args], {
			stdio: "inherit",
		});
	ffmpeg([
		...inputs,
		"-filter_complex",
		filters.join(";"),
		"-map",
		`[v${captions.length}]`,
		"-t",
		total.toFixed(2),
		"-c:v",
		"libx264",
		"-crf",
		"26",
		"-preset",
		"slow",
		"-pix_fmt",
		"yuv420p",
		"-movflags",
		"+faststart",
		"-an",
		output,
	]);
	ffmpeg([
		"-ss",
		String(posterAtSeconds),
		"-i",
		output,
		"-frames:v",
		"1",
		"-vf",
		`scale=${width / 2}:-2`,
		"-q:v",
		"4",
		output.replace(/\.mp4$/, ".jpg"),
	]);
	rmSync(workDir, { recursive: true, force: true });
	console.log(`${output} (${total.toFixed(1)} s, ${frames.length} frames)`);
}
