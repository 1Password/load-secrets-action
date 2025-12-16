import { expect } from "@jest/globals";

import { ReleaseChannel } from "./constants";
import { VersionResolver } from "./version-resolver";

describe("VersionResolver", () => {
	test("should throw error when invalid version provided", () => {
		expect(() => new VersionResolver("vv")).toThrow();
	});

	test("should throw error when version is empty", () => {
		expect(() => new VersionResolver("")).toThrow();
	});

	test("should throw error for major version only", () => {
		expect(() => new VersionResolver("1")).toThrow();
	});

	test("should throw error for major and minor version only", () => {
		expect(() => new VersionResolver("1.0")).toThrow();
	});

	test("should resolve latest stable version", async () => {
		const versionResolver = new VersionResolver(ReleaseChannel.latest);
		await versionResolver.resolve();
		expect(versionResolver.get()).toBeDefined();
	});

	test("should resolve latest beta version", async () => {
		const versionResolver = new VersionResolver(ReleaseChannel.latestBeta);
		await versionResolver.resolve();
		expect(versionResolver.get()).toBeDefined();
	});

	test("should resolve version without 'v' prefix", async () => {
		const versionResolver = new VersionResolver("1.0.0");
		await versionResolver.resolve();
		expect(versionResolver.get()).toBe("v1.0.0");
	});

	test("should resolve version with 'v' prefix", async () => {
		const versionResolver = new VersionResolver("v1.0.0");
		await versionResolver.resolve();
		expect(versionResolver.get()).toBe("v1.0.0");
	});

	test("should resolve beta version without 'v' prefix", async () => {
		const versionResolver = new VersionResolver("2.19.0-beta.01");
		await versionResolver.resolve();
		expect(versionResolver.get()).toBe("v2.19.0-beta.01");
	});

	test("should resolve beta version with 'v' prefix", async () => {
		const versionResolver = new VersionResolver("v2.19.0-beta.01");
		await versionResolver.resolve();
		expect(versionResolver.get()).toBe("v2.19.0-beta.01");
	});
});
