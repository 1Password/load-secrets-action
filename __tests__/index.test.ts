/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import * as main from "../src/main";

// Mock the action's entrypoint
const runMock = jest.spyOn(main, "run").mockImplementation();

describe("index", () => {
  it("calls run when imported", async () => {
    await import("../src/index");

    expect(runMock).toHaveBeenCalled();
  });
});
