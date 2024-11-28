export interface SecretReferenceResolver {
	resolve(ref: string): Promise<string>;
}

export type SecretReference = {
	vault_name: string;
	item_name: string;
	section_name: string | null;
	field_name: string;
};
