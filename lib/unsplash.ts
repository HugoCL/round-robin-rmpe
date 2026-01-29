export async function getRandomPhoto(query = "workspace") {
	const response = await fetch(
		`https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`,
		{
			headers: {
				Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
			},
			next: { revalidate: 86400 }, // Cache for 1 day
		},
	);

	if (!response.ok) return null;

	const photo = await response.json();
	return {
		url: photo.urls.regular as string,
		alt: (photo.alt_description as string) || "Background image",
		photographer: photo.user.name as string,
		photographerUrl: photo.user.links.html as string,
	};
}
