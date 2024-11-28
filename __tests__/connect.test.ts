import { ref_regex } from "../src/auth/connect";
import { expect } from "@jest/globals";

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
