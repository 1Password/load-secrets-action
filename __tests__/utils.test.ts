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
import { expect } from "@jest/globals";

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
    expect(utils.getAuth).toThrow(authErr);
  });

  it("should throw an error when partial Connect config is provided", () => {
    process.env[envConnectHost] = testConnectHost;
    expect(utils.getAuth).toThrow(authErr);
  });

  it("should be authenticated as a Connect client", () => {
    process.env[envConnectHost] = testConnectHost;
    process.env[envConnectToken] = testConnectToken;
    expect(utils.getAuth).not.toThrow(authErr);
    expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
  });

  it("should be authenticated as a service account", () => {
    process.env[envServiceAccountToken] = testServiceAccountToken;
    expect(utils.getAuth).not.toThrow(authErr);
    expect(core.info).toHaveBeenCalledWith(
      "Authenticated with Service account.",
    );
  });

  it("should prioritize Connect over service account if both are configured", () => {
    process.env[envServiceAccountToken] = testServiceAccountToken;
    process.env[envConnectHost] = testConnectHost;
    process.env[envConnectToken] = testConnectToken;
    expect(utils.getAuth).not.toThrow(authErr);
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
    expect(core.exportVariable).not.toHaveBeenCalled();

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
    expect(core.setOutput).not.toHaveBeenCalled();
    expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
  });
});

describe("loadSecrets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue(["MOCK_SECRET"]);
    jest.spyOn(utils, "getAuth").mockImplementation();
  });

  it("sets the client info and gets the executed output", async () => {
    await utils.loadSecrets(utils.getAuth(), true);

    expect(core.exportVariable).toHaveBeenCalledWith(
      "OP_MANAGED_VARIABLES",
      "MOCK_SECRET",
    );
  });

  it("return early if no env vars with secrets found", async () => {
    jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue([]);
    jest.spyOn(utils, "extractSecret");

    await utils.loadSecrets(utils.getAuth(), true);

    expect(utils.extractSecret).not.toHaveBeenCalled();
    expect(core.exportVariable).not.toHaveBeenCalled();
  });

  describe("core.exportVariable", () => {
    it("is called when shouldExportEnv is true", async () => {
      await utils.loadSecrets(utils.getAuth(), true);

      expect(core.exportVariable).toHaveBeenCalledTimes(1);
    });

    it("is not called when shouldExportEnv is false", async () => {
      await utils.loadSecrets(utils.getAuth(), false);

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

describe("ref_regex", () => {
  it("with space", () => {
    const ref = "op://vault/Secure Note/field";
    expect(ref).toMatch(utils.ref_regex);

    const exec = utils.ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("vault");
    expect(exec?.groups?.item_name).toBe("Secure Note");
    expect(exec?.groups?.section_name).toBeUndefined();
    expect(exec?.groups?.field_name).toBe("field");
  });

  it("with section", () => {
    const ref = "op://vault/item/section/text";
    expect(ref).toMatch(utils.ref_regex);

    const exec = utils.ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("vault");
    expect(exec?.groups?.item_name).toBe("item");
    expect(exec?.groups?.section_name).toBe("section");
    expect(exec?.groups?.field_name).toBe("text");
  });
});

describe("loadSecretRefsFromEnv", () => {
  const OLD_ENV = process.env;
  let spy: jest.SpiedFunction<typeof core.warning>;

  beforeAll(() => {
    jest.restoreAllMocks();
  })

  beforeEach(() => {
    spy = jest.spyOn(core, "warning")
    process.env = {
      ...OLD_ENV,
    };
  })

  afterAll(() => {
    process.env = OLD_ENV;
  })

  it("load from env", () => {
    process.env.TEST_SECRET = "op://vault/item/section/field";
    const paths = utils.loadSecretRefsFromEnv();
    expect(paths).toStrictEqual(["TEST_SECRET"]);
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it("exist invalid secret ref", () => {
    process.env.TEST_SECRET = "op://vault/item/section/something-else/field/a";
    const paths = utils.loadSecretRefsFromEnv();
    expect(paths).toStrictEqual([]);
    expect(spy).toHaveBeenCalledWith("omitted 'op://vault/item/section/something-else/field/a' seems not a valid secret reference, please check https://developer.1password.com/docs/cli/secret-references")
  })

  it("mixed valid and invalid secret refs", () => {
    process.env.TEST_SECRET = "op://vault/item/section/field";
    process.env.INVALID_SECRET = "op://vault/item/section/something-else/field/a";
    const paths = utils.loadSecretRefsFromEnv();
    expect(paths).toStrictEqual(["TEST_SECRET"])
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
