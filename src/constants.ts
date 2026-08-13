export const envConnectHost = "OP_CONNECT_HOST";
export const envConnectToken = "OP_CONNECT_TOKEN";
export const envServiceAccountToken = "OP_SERVICE_ACCOUNT_TOKEN";
export const envManagedVariables = "OP_MANAGED_VARIABLES";
export const envFilePath = "OP_ENV_FILE";
export const envWorkloadId = "OP_WORKLOAD_ID";
export const envEnvironmentId = "OP_ENVIRONMENT_ID";
export const envIntegrationKey = "OP_INTEGRATION_KEY";

export const authErr = `Authentication error with environment variables: you must set one of 1) ${envServiceAccountToken}, 2) both ${envConnectHost} and ${envConnectToken}, or 3) all of ${envWorkloadId}, ${envEnvironmentId}, and ${envIntegrationKey} to use Workload Identity.`;
