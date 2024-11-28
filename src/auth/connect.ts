import type { SecretReference, SecretReferenceResolver } from "./types";
import { OnePasswordConnect } from "@1password/connect";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { ref_regex } from "../utils";

export class Connect implements SecretReferenceResolver {
	op: OPConnect;

	constructor(serverURL: string, token: string) {
		this.op = OnePasswordConnect({
			serverURL,
			token,
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
		const { vaultName, itemName, sectionName, fieldName } =
			match.groups as SecretReference;

		const vault = await this.op.getVault(vaultName);
		if (!vault.id) {
			return undefined;
		}
		const item = await this.op.getItem(vault.id, itemName);

		let itemFields = item.fields;
    const errFiledName = sectionName ? `${sectionName}.${fieldName}` : fieldName;
		if (sectionName) {
			const section = item.sections?.filter(
				(s) => s.label === sectionName || s.id === sectionName,
			);
      if (section === undefined || section.length == 0) {
        throw new Error(`The item does not have a field '${errFiledName}'`)
      }
      const sectionIds= section.map(s => s.id!);
      itemFields = itemFields?.filter(
        (f) => f.section && sectionIds.includes(f.section.id!)
      );
		}

		const matchedFields = itemFields?.filter(
			(f) => f.id === fieldName || f.label === fieldName,
		);

		if (matchedFields == undefined || matchedFields.length == 0) {
			throw new Error(`The item does not have a field '${errFiledName}'`);
		}
		if (matchedFields.length > 1) {
			throw new Error(`The item has more than one '${errFiledName}' field`);
		}

		return matchedFields[0]!.value;
	}
}
