import { ref_regex } from "../src/service/connect/items";
import { expect } from "@jest/globals";

describe("connect references regex test", () => {
  it("secret ref with ordinary text", () => {
    const ref =
      "op://d4472vsddcneis7b4onz4v75nu/Secure Note/weuaijejjhpp2o3em5dtokca2a";
    expect(ref).toMatch(ref_regex);

    const exec = ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("d4472vsddcneis7b4onz4v75nu");
    expect(exec?.groups?.item_name).toBe("Secure Note");
    expect(exec?.groups?.section_name).toBeUndefined();
    expect(exec?.groups?.field_name).toBe("weuaijejjhpp2o3em5dtokca2a");
  });

  it("secret ref with section", () => {
    const ref = "op://dev/5vtojw237m2cxymfkfhtxsrazm/cs/text";
    expect(ref).toMatch(ref_regex);

    const exec = ref_regex.exec(ref);
    expect(exec).not.toBeNull();
    expect(exec?.groups).not.toBeNull();
    expect(exec?.groups?.vault_name).toBe("dev");
    expect(exec?.groups?.item_name).toBe("5vtojw237m2cxymfkfhtxsrazm");
    expect(exec?.groups?.section_name).toBe("cs");
    expect(exec?.groups?.field_name).toBe("text");
  });
});
