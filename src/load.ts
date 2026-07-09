import merge from "lodash.merge";
import { concatMap, from, lastValueFrom } from "rxjs";
import { reduce } from "rxjs/operators";
import { z } from "zod";

import { resolveConfigFilePath } from "./config";

type ConfigData = Record<string, unknown>;

export async function load<Config>(
    configSchema: z.ZodType<Config>,
    rootDir: string,
    configFiles: string[] = ["global.toml", "local.toml"],
): Promise<Config> {
    const config$ = from(configFiles).pipe(
        concatMap(async (fileName) => {
            const file = Bun.file(resolveConfigFilePath(rootDir, fileName));
            if (await file.exists()) {
                const text = await file.text();
                return Bun.TOML.parse(text) as ConfigData;
            }
            return {};
        }),
        reduce((acc, cur) => merge(acc, cur), {} as ConfigData),
    );

    const merged = await lastValueFrom(config$);

    try {
        return configSchema.parse({ root_dir: rootDir, ...merged });
    } catch (err) {
        if (err instanceof z.ZodError) {
            const files = configFiles
                .map((f) => resolveConfigFilePath(rootDir, f))
                .join(", ");
            const details = err.issues
                .map((i) => {
                    const path = i.path?.length ? i.path.join(".") : "<root>";
                    const expected =
                        "expected" in i && i.expected !== undefined
                            ? `\n  expected: ${i.expected}`
                            : "";
                    const received =
                        "received" in i && i.received !== undefined
                            ? `\n  received: ${i.received}`
                            : "";
                    return `- path: ${path}\n  code: ${i.code}\n  message: ${i.message}${expected}${received}`;
                })
                .join("\n");
            // prettier-ignore
            const helpful =
                `From: ${files}\n` +
                `Computed root_dir: ${rootDir}\n` +
                `Schema validation issues:\n${details}`;
            throw new Error(helpful, { cause: err });
        }
        throw err;
    }
}
