# @andreas-timm/config

Bun-first utilities for loading layered TOML config files and validating the merged result with Zod.

## Features

- Load `global.toml`, `local.toml`, or custom TOML file lists in order.
- Resolve config files relative to a project root, from absolute paths, or from `~`.
- Deep-merge files with later files overriding earlier values.
- Inject `root_dir` before schema validation.
- Report Zod validation issues with the resolved source file paths.
- Post-process known string values such as `secret = "!pass show secret"` as command-backed secrets.

## Install

```sh
pnpm add @andreas-timm/config zod
```

## Usage

```ts
// src/config.ts
import { join } from "node:path";
import { z } from "zod";
import { load } from "@andreas-timm/config";

export const ConfigSchema = z
    .object({
        root_dir: z.string(),
    })
    .strict();

export type Config = z.infer<typeof ConfigSchema>;

const rootDir = join(import.meta.dir, "..");
const configFiles = ["global.toml", "local.toml"];

let cached: Promise<Config> | undefined;

export function loadConfig(): Promise<Config> {
    cached ??= load(ConfigSchema, rootDir, configFiles);
    return cached;
}

export function resetConfig(): void {
    cached = undefined;
}
```

`loadConfig()` caches the promise in module scope, so files are read and parsed only on the first call and concurrent callers share the in-flight load. Call `resetConfig()` to force a reload in tests or after editing a TOML file.

## Command-backed secrets

Use command-backed values when an application should keep the secret in a password manager or external secret store, but still describe how to fetch it in TOML:

```toml
secret = "!pass show secret"
literal = "!!starts-with-bang"
```

Post-process only the specific field that may contain a command:

```ts
import { load, resolveShellCommand } from "@andreas-timm/config";

const config = await load(ConfigSchema, rootDir, configFiles);
const secret = await resolveShellCommand(config.secret, { cwd: rootDir });
```

This keeps loading as plain TOML/Zod validation and makes command execution an application-level decision. The config schema should validate the placeholder as a string, and the application should validate or use the resolved secret at the point where it is needed.

You can also write the resolved value back into your application config object:

```ts
const config = await load(ConfigSchema, rootDir, configFiles);
config.secret = await resolveShellCommand(config.secret, { cwd: rootDir });
```

By default, command resolution uses `!` as the prefix, `!!` as a literal escape, strips one final newline from command output, applies a 10 second timeout, and rejects stdout or stderr above 16 KiB. Treat any value passed to `resolveShellCommand()` as trusted executable input.

For the full setup pattern and usage guidance, see [`skills/bun-config/SKILL.md`](./skills/bun-config/SKILL.md).

## Agent skill `bun-config`

The package ships a reusable agent skill for assistants that need to add typed TOML configuration loading to Bun projects.

- In this repo: [`skills/bun-config/SKILL.md`](./skills/bun-config/SKILL.md)
- After installation: `node_modules/@andreas-timm/config/skills/bun-config/` with the same `SKILL.md`

To expose the installed skill under a project-local skills directory:

```sh
mkdir -p .agents/skills
ln -s ../../node_modules/@andreas-timm/config/skills/bun-config .agents/skills/bun-config
```
