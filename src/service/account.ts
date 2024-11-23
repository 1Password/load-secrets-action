import type { SecretReferenceResolver } from "./types";
import { Client, createClient } from "@1password/sdk";
import process from "node:process";
import { envServiceAccountToken } from "../constants";
import assert from "node:assert";
import { version } from "../../package.json";

export class Account implements SecretReferenceResolver {
	private readonly token: string;
	private client?: Client;

	constructor() {
		assert(
			process.env[envServiceAccountToken],
			`${envServiceAccountToken} is required`,
		);
		this.token = process.env[envServiceAccountToken];
	}

	async init(): Promise<Client> {
		if (!this.client) {
			this.client = await createClient({
				auth: this.token,
				integrationName: "GitHub Action load-secrets-action",
				integrationVersion: version,
			});
		}
		return this.client;
	}

	async resolve(ref: string): Promise<string> {
		const client = await this.init();
		return client.secrets.resolve(ref);
	}
}
