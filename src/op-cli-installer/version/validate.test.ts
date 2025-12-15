import { describe, expect, it } from "@jest/globals";

import { validateVersion } from "./validate";

describe("validateVersion", () => {
	it('should not throw for "latest"', () => {
		expect(() => validateVersion("latest")).not.toThrow();
	});

	it('should not throw for "latest-beta"', () => {
		expect(() => validateVersion("latest-beta")).not.toThrow();
	});

	it('should not throw for valid semver version "2.18.0"', () => {
		expect(() => validateVersion("2.18.0")).not.toThrow();
	});

	it('should throw for partial version "2"', () => {
		expect(() => validateVersion("2")).toThrow();
	});

	it('should throw for partial version "2.1"', () => {
		expect(() => validateVersion("2.1")).toThrow();
	});

	it('should not throw for valid beta "2.19.0-beta.01"', () => {
		expect(() => validateVersion("2.19.0-beta.01")).not.toThrow();
	});

	it('should not throw for valid beta "2.19.3-beta.12"', () => {
		expect(() => validateVersion("2.19.3-beta.12")).not.toThrow();
	});

	it('should not throw for coerced version "v2.19.0"', () => {
		expect(() => validateVersion("v2.19.0")).not.toThrow();
	});

	it('should throw for invalid version "latest-abc"', () => {
		expect(() => validateVersion("latest-abc")).toThrow();
	});

	it("should throw for empty string", () => {
		expect(() => validateVersion("")).toThrow();
	});
});
