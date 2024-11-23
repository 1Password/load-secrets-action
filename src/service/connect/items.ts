import { OPConnect } from "@1password/connect";
import type { SecretReference } from "../types";

/**
 * `op://<vault-name>/<item-name>/[section-name/]<field-name>`
 */
export const ref_regex =
	/^op:\/\/(?<vault_name>[^/]+)\/(?<item_name>[^/]+)\/((?<section_name>[^/]+)\/)?(?<field_name>[^/]+)$/;

export async function resolve_by_path(
	client: OPConnect,
	path: string,
): Promise<string | undefined> {
	const match = ref_regex.exec(path);
	if (!match) {
		throw new Error(`Invalid secret reference: ${path}`);
	}
	const { vault_name, item_name, section_name, field_name } =
		match.groups as SecretReference;

	const vault = await client.getVault(vault_name);
	if (!vault.id) {
		return undefined;
	}
	const item = await client.getItem(vault.id, item_name);

	let item_fields = item.fields;
	if (section_name) {
		// how to deal with same label and id?
		const section = item.sections?.filter(
			(s) => s.label === section_name || s.id === section_name,
		);

		if (section && section.length > 0) {
			item_fields = item_fields?.filter(
				(f) => f.section?.id === section[0]?.id,
			);
		}
	}
	const filed = item_fields?.filter(
		(f) => f.id === field_name || f.label === field_name,
	)[0];
	return filed?.value;
}
