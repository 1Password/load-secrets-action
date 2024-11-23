import type { SecretReferenceResolver } from "../types";
import process from "node:process";
import { envConnectHost, envConnectToken } from "../../constants";
import assert from "node:assert";
import { OnePasswordConnect } from "@1password/connect";
import { OPConnect } from "@1password/connect/dist/lib/op-connect";
import { resolve_by_path } from "./items";

/**
 * See https://github.com/1Password/onepassword-operator/blob/ced45c33d4c1e0267dc5af54231c5a29accce4c4/pkg/onepassword/items.go#L53
 */
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
		const secret = await resolve_by_path(this.op, ref);
		if (!secret) {
			throw new Error(`Can't resolve this ${ref}`);
		}
		return secret;
	}
}
