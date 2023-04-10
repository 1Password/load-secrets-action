import { semverToInt } from "./utils";

describe("semverToInt", () => {
	it("converts a semver string to build number", () => {
		expect(semverToInt("0.1.2")).toBe("000102");
		expect(semverToInt("1.2.3")).toBe("010203");
		expect(semverToInt("12.2.39")).toBe("120239");
		expect(semverToInt("2.1.284")).toBe("0201284");
	});
});
