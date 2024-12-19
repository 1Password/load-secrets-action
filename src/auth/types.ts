export interface SecretReferenceResolver {
	resolve(ref: string): Promise<string>;
}

export interface SecretReference {
	vaultName: string;
	itemName: string;
	sectionName: string | null;
	fieldName: string;
}
