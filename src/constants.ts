export const envConnectHost = "OP_CONNECT_HOST";
export const envConnectToken = "OP_CONNECT_TOKEN";
export const envServiceAccountToken = "OP_SERVICE_ACCOUNT_TOKEN";
export const envManagedVariables = "OP_MANAGED_VARIABLES";
export const envFilePath = "OP_ENV_FILE";

export const authErr = `Authentication error with environment variables: you must set either 1) ${envServiceAccountToken}, or 2) both ${envConnectHost} and ${envConnectToken}.`;
