import { Client, createClient } from "@1password/sdk";
import { version } from "../../package.json";
import type { SecretReferenceResolver } from "./types";

export class ServiceAccount implements SecretReferenceResolver {
	private readonly token: string;
	private client?: Client;

	public constructor(token: string) {
		this.token = token;
	}

	public async init(): Promise<Client> {
		if (!this.client) {
			this.client = await createClient({
				auth: this.token,
				integrationName: "1Password - Load Secrets GitHub Action",
				integrationVersion: version,
			});
		}
		return this.client;
	}

	public async resolve(ref: string): Promise<string> {
		const client = await this.init();
		return client.secrets.resolve(ref);
	}
}
