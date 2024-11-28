import * as core from "@actions/core";
import {
  authErr,
  envConnectHost,
  envConnectToken,
  envManagedVariables,
  envServiceAccountToken,
} from "../src/constants";
import * as utils from "../src/utils";
import type { SecretReferenceResolver } from "../src/auth/types";

jest.mock("@actions/core");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateAuth", () => {
  const testConnectHost = "https://localhost:8000";
  const testConnectToken = "token";
  const testServiceAccountToken = "ops_token";

  beforeEach(() => {
    process.env[envConnectHost] = "";
    process.env[envConnectToken] = "";
    process.env[envServiceAccountToken] = "";
  });

  it("should throw an error when no config is provided", () => {
    expect(utils.validateAuth).toThrow(authErr);
  });

  it("should throw an error when partial Connect config is provided", () => {
    process.env[envConnectHost] = testConnectHost;
    expect(utils.validateAuth).toThrow(authErr);
  });

  it("should be authenticated as a Connect client", () => {
    process.env[envConnectHost] = testConnectHost;
    process.env[envConnectToken] = testConnectToken;
    expect(utils.validateAuth).not.toThrow(authErr);
    expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
  });

  it("should be authenticated as a service account", () => {
    process.env[envServiceAccountToken] = testServiceAccountToken;
    expect(utils.validateAuth).not.toThrow(authErr);
    expect(core.info).toHaveBeenCalledWith(
      "Authenticated with Service account.",
    );
  });

  it("should prioritize Connect over service account if both are configured", () => {
    process.env[envServiceAccountToken] = testServiceAccountToken;
    process.env[envConnectHost] = testConnectHost;
    process.env[envConnectToken] = testConnectToken;
    expect(utils.validateAuth).not.toThrow(authErr);
    expect(core.warning).toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
  });
});

describe("extractSecret", () => {
  const envTestSecretEnv = "TEST_SECRET";
  const testSecretRef = "op://vault/item/secret";
  const testSecretValue = "Secret1@3$";

  class DumbResolver implements SecretReferenceResolver {
    async resolve(): Promise<string> {
      return Promise.resolve(testSecretValue);
    }
  }

  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  beforeEach(() => {
    process.env[envTestSecretEnv] = testSecretRef;
  });

  it("should set secret as step output", async () => {
    await utils.extractSecret(new DumbResolver(), envTestSecretEnv, false);
    expect(core.exportVariable).not.toHaveBeenCalledWith(
      envTestSecretEnv,
      testSecretValue,
    );
    expect(core.setOutput).toHaveBeenCalled();

    expect(core.setOutput).toHaveBeenCalledWith(
      envTestSecretEnv,
      testSecretValue,
    );
    expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
  });

  it("should set secret as environment variable", async () => {
    await utils.extractSecret(new DumbResolver(), envTestSecretEnv, true);
    expect(core.exportVariable).toHaveBeenCalledWith(
      envTestSecretEnv,
      testSecretValue,
    );
    expect(core.setOutput).not.toHaveBeenCalledWith(
      envTestSecretEnv,
      testSecretValue,
    );
    expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
  });
});

describe("loadSecrets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue(["MOCK_SECRET"]);
    jest.spyOn(utils, "buildSecretResolver").mockReturnThis();
  });

  it("sets the client info and gets the executed output", async () => {
    await utils.loadSecrets(true);

    expect(core.exportVariable).toHaveBeenCalledWith(
      "OP_MANAGED_VARIABLES",
      "MOCK_SECRET",
    );
  });

  it("return early if no env vars with secrets found", async () => {
    jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue([]);
    await utils.loadSecrets(true);

    expect(core.exportVariable).not.toHaveBeenCalled();
  });

  describe("core.exportVariable", () => {
    it("is called when shouldExportEnv is true", async () => {
      await utils.loadSecrets(true);

      expect(core.exportVariable).toHaveBeenCalledTimes(1);
    });

    it("is not called when shouldExportEnv is false", async () => {
      await utils.loadSecrets(false);

      expect(core.exportVariable).not.toHaveBeenCalled();
    });
  });
});

describe("unsetPrevious", () => {
  const testManagedEnv = "TEST_SECRET";
  const testSecretValue = "MyS3cr#T";

  beforeEach(() => {
    process.env[testManagedEnv] = testSecretValue;
    process.env[envManagedVariables] = testManagedEnv;
  });

  it("should unset the environment variable if user wants it", () => {
    utils.unsetPrevious();
    expect(core.info).toHaveBeenCalledWith("Unsetting previous values ...");
    expect(core.info).toHaveBeenCalledWith("Unsetting TEST_SECRET");
    expect(core.exportVariable).toHaveBeenCalledWith("TEST_SECRET", "");
  });
});
