# @andreas-timm/config

Bun-first utilities for loading layered TOML config files and validating the merged result with Zod.

## Features

- Load `global.toml`, `local.toml`, or custom TOML file lists in order.
- Resolve config files relative to a project root, from absolute paths, or from `~`.
- Deep-merge files with later files overriding earlier values.
- Inject `root_dir` before schema validation.
- Report Zod validation issues with the resolved source file paths.

## Install

```sh
bun add @andreas-timm/config zod
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
