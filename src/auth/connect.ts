import type { SecretReference, SecretReferenceResolver } from "./types";
import process from "node:process";
import { envConnectHost, envConnectToken } from "../constants";
import assert from "node:assert";
import { OnePasswordConnect } from "@1password/connect";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { ref_regex } from "../utils";

export class Connect implements SecretReferenceResolver {
	op: OPConnect;

	constructor() {
		assert(process.env[envConnectHost], `${envConnectHost} is required`);
		assert(process.env[envConnectToken], `${envConnectToken} is required`);

		this.op = OnePasswordConnect({
			serverURL: process.env[envConnectHost],
			token: process.env[envConnectToken],
			keepAlive: true,
		});
	}

	async resolve(ref: string): Promise<string> {
		const secret = await this.resolveByPath(ref);
		if (!secret) {
			throw new Error(`Can't resolve this ${ref}`);
		}
		return secret;
	}

	/**
	 * This is method derive from https://github.com/1Password/onepassword-operator/blob/ced45c33d4c1e0267dc5af54231c5a29accce4c4/pkg/onepassword/items.go
	 *
	 * @param path Secret reference path, match `ref_regex`
	 */
	private async resolveByPath(path: string): Promise<string | undefined> {
		const match = ref_regex.exec(path);
		if (!match) {
			throw new Error(`Invalid secret reference: ${path}`);
		}
		const { vault_name, item_name, section_name, field_name } =
			match.groups as SecretReference;

		const vault = await this.op.getVault(vault_name);
		if (!vault.id) {
			return undefined;
		}
		const item = await this.op.getItem(vault.id, item_name);

		let item_fields = item.fields;
    const err_filed_name = section_name ? `${section_name}.${field_name}` : field_name;
		if (section_name) {
			const section = item.sections?.filter(
				(s) => s.label === section_name || s.id === section_name,
			);
      if (section === undefined || section.length == 0) {
        throw new Error(`The item does not have a field '${err_filed_name}'`)
      }
      const section_ids= section.map(s => s.id!);
      item_fields = item_fields?.filter(
        (f) => f.section && section_ids.includes(f.section.id!)
      );
		}

		const matched_fields = item_fields?.filter(
			(f) => f.id === field_name || f.label === field_name,
		);

		if (matched_fields == undefined || matched_fields.length == 0) {
			throw new Error(`The item does not have a field '${err_filed_name}'`);
		}
		if (matched_fields.length > 1) {
			throw new Error(`The item has more than one '${err_filed_name}' field`);
		}

		return matched_fields[0]!.value;
	}
}
