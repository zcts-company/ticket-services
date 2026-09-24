export function getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (value === undefined || value === "") {
        throw new Error(`Required environment variable "${name}" is not set`);
    }

    return value;
}

export function getEnvNumber(name: string, defaultValue?: number): number {
    const value = process.env[name];

    if (value === undefined || value === "") {
        if (defaultValue !== undefined) {
            return defaultValue;
        }

        throw new Error(`Required environment variable "${name}" is not set`);
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        throw new Error(
            `Environment variable "${name}" must be a number, got "${value}"`
        );
    }

    return parsed;
}