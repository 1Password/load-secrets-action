import { expect } from "@jest/globals";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { FullItem } from "@1password/connect/dist/model/fullItem";
import { FullItemAllOfFields } from "@1password/connect/dist/model/fullItemAllOfFields";
import { Connect } from "../src/auth/connect";

describe("test connect with different secret refs", () => {
	// eslint-disable-next-line no-restricted-syntax
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
					value: "filed_id_0_value",
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
		await expect(
			connect.resolve("op://vault/item/not_exist/text"),
		).rejects.toThrow("The item does not have a field 'not_exist.text'");
	});

	it("filed not exist", async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://vault/item/duplicate/not_exist"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it("filed duplicate", async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://vault/item/duplicate/text"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it("duplicate section and with unique id", async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://vault/item/duplicate/filed_id_1"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it("without section", async () => {
		const connect = new Connect(host, token);
		await expect(connect.resolve("op://vault/item/filed_id_0")).resolves.toBe(
			"filed_id_0_value",
		);
	});
});

describe("align test cases with the @1password/sdk@0.1.7", () => {
	// eslint-disable-next-line no-restricted-syntax
	const host = "http://localhost:8080";
	const token = "token";

	beforeEach(() => {
		jest.spyOn(OPConnect.prototype, "getVault").mockResolvedValue({
			id: "dev",
		});
		// derive from https://github.com/1Password/load-secrets-action/pull/82#discussion_r1888058279
		jest.spyOn(OPConnect.prototype, "getItem").mockResolvedValue({
			title: "GitHub Action Test Bak",
			extractOTP: jest.fn(),
			category: FullItem.CategoryEnum.SecureNote,
			vault: {
				id: "dev",
			},
			fields: [
				{
					id: "notesPlain",
					label: "notesPlain",
					purpose: FullItemAllOfFields.PurposeEnum.Notes,
					type: FullItemAllOfFields.TypeEnum.String,
				},
				{
					id: "filed_id_0",
					label: "text",
					section: {
						id: "section_id_1",
					},
					type: FullItemAllOfFields.TypeEnum.String,
					value: "`section/text`",
				},
				{
					id: "filed_id_1",
					label: "text",
					section: {
						id: "section_id_0",
					},
					type: FullItemAllOfFields.TypeEnum.String,
					value: "`add more/text`",
				},
				{
					id: "filed_id_2",
					label: "cs",
					section: {
						id: "section_id_0",
					},
					type: FullItemAllOfFields.TypeEnum.String,
					value: "`add more/cs`",
				},
				{
					id: "filed_id_3",
					label: "text",
					section: {
						id: "add more",
					},
					type: FullItemAllOfFields.TypeEnum.String,
					value: "hello world",
				},
				{
					id: "filed_id_4",
					label: "text",
					section: {
						id: "section_id_2",
					},
					type: FullItemAllOfFields.TypeEnum.String,
					value: "1",
				},
				{
					id: "filed_id_5",
					label: "url",
					section: {
						id: "section_id_3",
					},
					type: FullItemAllOfFields.TypeEnum.Url,
					value: "2",
				},
			],
			id: "item_id_0",
			sections: [
				{
					id: "add more",
				},
				{
					id: "section_id_0",
					label: "add more",
				},
				{
					id: "section_id_1",
					label: "section",
				},
				{
					id: "section_id_2",
					label: "duplicate",
				},
				{
					id: "section_id_3",
					label: "duplicate",
				},
			],
		});
	});

	it('test "op://dev/GitHub Action Test Bak/section/text"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/section/text"),
		).resolves.toBe("`section/text`");
	});

	it('test "op://dev/GitHub Action Test Bak/add more/text"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/add more/text"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/add more/cs"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/add more/cs"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/text"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/text"),
		).resolves.toBe("hello world");
	});

	it('test "op://dev/GitHub Action Test Bak/cs"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/cs"),
		).resolves.toBe("`add more/cs`");
	});

	it('test "op://dev/GitHub Action Test Bak/duplicate/not_exist"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/duplicate/not_exist"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/duplicate/not_exist"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/duplicate/not_exist"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/duplicate/url"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/duplicate/url"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/duplicate/url"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/duplicate/url"),
		).rejects.toThrow("More than one section matched the secret reference");
	});

	it('test "op://dev/GitHub Action Test Bak/section_id_2/text"', async () => {
		const connect = new Connect(host, token);
		await expect(
			connect.resolve("op://dev/GitHub Action Test Bak/section_id_2/text"),
		).resolves.toBe("1");
	});
});
