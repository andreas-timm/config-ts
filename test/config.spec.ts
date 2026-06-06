import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { load, resolveShellCommand } from "../src/index.ts";

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

    it("keeps command-backed values as plain config during load", async () => {
        const rootDir = await createTempDir();
        await writeFile(
            join(rootDir, "local.toml"),
            'secret = "!pass show secret"\n',
        );

        const ConfigSchema = z
            .object({
                root_dir: z.string(),
                secret: z.string(),
            })
            .strict();

        const config = await load(ConfigSchema, rootDir, ["local.toml"]);

        expect(config).toEqual({
            root_dir: rootDir,
            secret: "!pass show secret",
        });
    });

    it("post-processes a command-backed string value", async () => {
        const secret = await resolveShellCommand('!printf "secret\\n"');

        expect(secret).toBe("secret");
    });

    it("keeps plain and escaped command-backed string values literal", async () => {
        await expect(resolveShellCommand("plain")).resolves.toBe("plain");
        await expect(resolveShellCommand("!!literal")).resolves.toBe(
            "!literal",
        );
    });

    it("rejects empty command-backed string values", async () => {
        await expect(resolveShellCommand("!")).rejects.toThrow(
            /Shell command config value is empty/u,
        );
    });

    it("rejects command-backed string values that produce too much output", async () => {
        await expect(
            resolveShellCommand("!printf secret", { maxOutputBytes: 3 }),
        ).rejects.toThrow(/produced more than 3 bytes/u);
    });
});
