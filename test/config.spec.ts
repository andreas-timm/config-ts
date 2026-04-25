import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { load } from "../src/index.ts";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "andreas-timm-config-test-"));
    tempDirs.push(dir);
    return dir;
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map((dir) => rm(dir, { force: true, recursive: true })),
    );
});

describe("@andreas-timm/config", () => {
    it("loads and merges TOML config files in order", async () => {
        const rootDir = await createTempDir();
        await writeFile(
            join(rootDir, "global.toml"),
            [
                'name = "global"',
                "",
                "[nested]",
                'keep = "yes"',
                'override = "global"',
                "",
            ].join("\n"),
        );
        await writeFile(
            join(rootDir, "local.toml"),
            ['name = "local"', "", "[nested]", 'override = "local"', ""].join(
                "\n",
            ),
        );

        const ConfigSchema = z
            .object({
                root_dir: z.string(),
                name: z.string(),
                nested: z
                    .object({
                        keep: z.string(),
                        override: z.string(),
                    })
                    .strict(),
            })
            .strict();

        await expect(load(ConfigSchema, rootDir)).resolves.toEqual({
            root_dir: rootDir,
            name: "local",
            nested: {
                keep: "yes",
                override: "local",
            },
        });
    });

    it("wraps Zod validation errors with file context", async () => {
        const rootDir = await createTempDir();
        const ConfigSchema = z
            .object({
                root_dir: z.string(),
                required: z.string(),
            })
            .strict();

        await expect(
            load(ConfigSchema, rootDir, ["missing.toml"]),
        ).rejects.toThrow(
            /From: .*missing\.toml[\s\S]*Schema validation issues:/u,
        );
    });
});
