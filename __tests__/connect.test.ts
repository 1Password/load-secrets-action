import { Connect, ref_regex } from "../src/auth/connect";
import { expect } from "@jest/globals";
import { describe } from "node:test";
import { envConnectHost, envConnectToken } from "../src/constants";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { FullItem } from "@1password/connect/dist/model/fullItem";

describe("connect references regex test", () => {
  it("secret ref with ordinary text", () => {
    const ref =
      "op://demovaultuuid/Secure Note/demofielduuid";
    expect(ref).toMatch(ref_regex);

    const exec = ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("demovaultuuid");
    expect(exec?.groups?.item_name).toBe("Secure Note");
    expect(exec?.groups?.section_name).toBeUndefined();
    expect(exec?.groups?.field_name).toBe("demofielduuid");
  });

  it("secret ref with section", () => {
    const ref = "op://dev/demoitemname/cs/text";
    expect(ref).toMatch(ref_regex);

    const exec = ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("dev");
    expect(exec?.groups?.item_name).toBe("demoitemname");
    expect(exec?.groups?.section_name).toBe("cs");
    expect(exec?.groups?.field_name).toBe("text");
  });
});

describe("test connect with different secret refs", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {};
    process.env[envConnectHost] = "http://localhost:8080";
    process.env[envConnectToken] = "token";

    jest.spyOn(OPConnect.prototype, "getVault").mockResolvedValue({
      id: "vault",
    });
    jest.spyOn(OPConnect.prototype, "getItem").mockResolvedValue({
      id: "item",
      extractOTP: jest.fn(),
      category: FullItem.CategoryEnum.Password,
      vault: {
        id: "vault_id",
      },
      fields: [
        {
          id: "filed_id_0",
          label: "text",
          value: "filed_id_0_value"
        },
        {
          id: "filed_id_1",
          label: "text",
          value: "filed_id_1_value",
          section: {
            id: "section_id_1",
          },
        },
        {
          id: "filed_id_2",
          label: "text",
          value: "filed_id_2_value",
          section: {
            id: "section_id_2",
          },
        },
      ],
      sections: [
        {
          id: "section_id_1",
          label: "duplicate",
        },
        {
          id: "section_id_2",
          label: "duplicate",
        },
      ],
    });
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("filed section not exist", async () => {
    const connect = new Connect();
    await expect(connect.resolve("op://vault/item/not_exist/text"),).rejects.toThrow("The item does not have a field 'not_exist.text'");
  });

  it("filed not exist", async () => {
    const connect = new Connect();
    await expect(connect.resolve("op://vault/item/duplicate/not_exist"),).rejects.toThrow("The item does not have a field 'duplicate.not_exist'");
  });

  it("filed duplicate", async () => {
    const connect = new Connect();
    await expect(connect.resolve("op://vault/item/duplicate/text"),).rejects.toThrow("The item has more than one 'duplicate.text' field");
  });

  it("duplicate section and with unique id", async () => {
    const connect = new Connect();
    await expect(connect.resolve("op://vault/item/duplicate/filed_id_1")).resolves.toBe("filed_id_1_value");
  });

  it("without section", async () => {
    const connect = new Connect();
    await expect(connect.resolve("op://vault/item/filed_id_0")).resolves.toBe("filed_id_0_value");
  })
});
