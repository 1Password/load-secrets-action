import * as core from "@actions/core";
import * as op from "@1password/sdk";
import * as connect from "@1password/connect";
import * as main from "../src/main";

const runMock = jest.spyOn(main, "run");

jest.mock("@actions/core");

describe("test main action", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      OP_MANAGED_VARIABLES: "OTHER_TEST_KEY",
      TEST: "op://dev/test/test-key",
    };
  });

  afterEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const commonCheck = (): void => {
    expect(runMock).toHaveReturned();
    expect(core.error).not.toHaveBeenCalled();

    // Verify that all the core library functions were called correctly
    expect(core.info).toHaveBeenNthCalledWith(
      1,
      "Unsetting previous values ...",
    );
    expect(core.info).toHaveBeenNthCalledWith(2, "Unsetting OTHER_TEST_KEY");
    expect(core.exportVariable).toHaveBeenNthCalledWith(1, "OTHER_TEST_KEY", "");

    expect(core.setOutput).toHaveBeenNthCalledWith(1, "TEST", "test-secret");
  };

  it("test service account", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";

    jest.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      switch (name) {
        case "unset-previous":
          return true;
        case "export-env":
          return false;
        default:
          return false;
      }
    });

    const opMock: jest.SpiedFunction<typeof op.createClient> = jest
      .spyOn(op, "createClient")
      .mockResolvedValue({
        secrets: {
          resolve: jest.fn().mockResolvedValue("test-secret"),
        },
        items: {
          get: jest.fn().mockImplementation(),
          create: jest.fn().mockImplementation(),
          put: jest.fn().mockImplementation(),
          delete: jest.fn().mockImplementation(),
          listAll: jest.fn().mockImplementation(),
        },
        vaults: {
          listAll: jest.fn().mockImplementation(),
        },
      });

    await main.run();
    expect(opMock).toHaveReturned();

    commonCheck();
  });

  it("test connect", async () => {
    process.env = {
      ...process.env,
      OP_CONNECT_HOST: "test-host",
      OP_CONNECT_TOKEN: "test-token",
    };

    jest.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      switch (name) {
        case "unset-previous":
          return true;
        case "export-env":
          return false;
        default:
          return false;
      }
    });

    jest.spyOn(connect, "OnePasswordConnect").mockImplementation(
      jest.fn().mockImplementation(() => ({
          getVault: jest.fn().mockResolvedValue({ id: "dev" }),
          getItem: jest.fn().mockResolvedValue({
            id: "test",
            fields: [{ id: "test-key", value: "test-secret" }],
          }),
        })),
    );

    await main.run();

    commonCheck();
  });
});
