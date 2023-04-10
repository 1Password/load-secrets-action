export const semverToInt = (input: string): string =>
	input
		.split(".")
		.map((n) => n.padStart(2, "0"))
		.join("");
