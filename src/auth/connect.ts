import { OnePasswordConnect } from "@1password/connect";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import type { FullItem } from "@1password/connect/dist/model/fullItem";
import type { FullItemAllOfSections } from "@1password/connect/dist/model/fullItemAllOfSections";
import type { FullItemAllOfFields } from "@1password/connect/dist/model/fullItemAllOfFields";
import { parseSecretRef } from "../utils";
import type { SecretReferenceResolver } from "./types";

export class Connect implements SecretReferenceResolver {
	private op: OPConnect;
	private errFieldName: string | undefined;

	public constructor(serverURL: string, token: string) {
		this.op = OnePasswordConnect({
			serverURL,
			token,
			keepAlive: true,
		});
	}

	public async resolve(ref: string): Promise<string> {
		const secret = await this.resolveByPath(ref);
		if (!secret) {
			throw new Error(`Can't resolve this ${ref}`);
		}
		return secret;
	}

	/**
	 * This is method derive from https://github.com/1Password/onepassword-operator/blob/ced45c33d4c1e0267dc5af54231c5a29accce4c4/pkg/onepassword/items.go
	 * @param path Secret reference path, match `ref_regex`
	 */
	private async resolveByPath(path: string): Promise<string | undefined> {
		const matched = parseSecretRef(path);
		if (!matched) {
			throw new Error(`Invalid secret reference: ${path}`);
		}
		const { vaultName, itemName, sectionName, fieldName } = matched;

		const vault = await this.op.getVault(vaultName);
		if (!vault.id) {
			return undefined;
		}
		const item = await this.op.getItem(vault.id, itemName);

		this.errFieldName = sectionName ? `${sectionName}.${fieldName}` : fieldName;

		let sectionId: string | undefined;
		if (sectionName) {
			sectionId = this.getSection(item, sectionName).id;
		}

		const matchedField = this.getField(item, sectionId, fieldName);
		return matchedField.value;
	}

	private getSection(item: FullItem, query: string): FullItemAllOfSections {
		const sections = item.sections?.filter(
			(s) => s.label === query || s.id === query,
		);
		if (sections === undefined || sections.length === 0) {
			throw new Error(`The item does not have a field '${this.errFieldName}'`);
		}
		if (sections.length > 1) {
			throw new Error("More than one section matched the secret reference");
		}
		return sections[0]!;
	}

	private getField(
		item: FullItem,
		sectionId: string | undefined,
		query: string,
	): FullItemAllOfFields {
		let fields = item.fields;

		if (sectionId) {
			fields = fields?.filter((f) => f.section?.id === sectionId);
		}

		fields = fields?.filter((f) => f.id === query || f.label === query);

		if (fields === undefined || fields.length === 0) {
			throw new Error(`The item does not have a field '${this.errFieldName}'`);
		}

		// if section part not provided, return fields with default section(empty or 'add more')
		if (!sectionId && fields.length > 1) {
			fields = fields.filter((f) => !f.section || f.section.id === "add more");
		}

		if (fields.length > 1) {
			throw new Error(
				`The item has more than one '${this.errFieldName}' field`,
			);
		}

		return fields[0]!;
	}
}
