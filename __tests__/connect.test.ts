import { Connect } from "../src/auth/connect";
import { expect } from "@jest/globals";
import { describe } from "node:test";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { FullItem } from "@1password/connect/dist/model/fullItem";

describe("test connect with different secret refs", () => {

  const host = "http://localhost:8080";
  const token = "token";

  beforeEach(() => {
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

  it("filed section not exist", async () => {
    const connect = new Connect(host, token);
    await expect(connect.resolve("op://vault/item/not_exist/text"),).rejects.toThrow("The item does not have a field 'not_exist.text'");
  });

  it("filed not exist", async () => {
    const connect = new Connect(host, token);
    await expect(connect.resolve("op://vault/item/duplicate/not_exist"),).rejects.toThrow("The item does not have a field 'duplicate.not_exist'");
  });

  it("filed duplicate", async () => {
    const connect = new Connect(host, token);
    await expect(connect.resolve("op://vault/item/duplicate/text"),).rejects.toThrow("The item has more than one 'duplicate.text' field");
  });

  it("duplicate section and with unique id", async () => {
    const connect = new Connect(host, token);
    await expect(connect.resolve("op://vault/item/duplicate/filed_id_1")).resolves.toBe("filed_id_1_value");
  });

  it("without section", async () => {
    const connect = new Connect(host, token);
    await expect(connect.resolve("op://vault/item/filed_id_0")).resolves.toBe("filed_id_0_value");
  })
});
