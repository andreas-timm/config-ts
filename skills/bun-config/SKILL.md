---
name: bun-config
description: Load layered TOML config files in Bun projects with `@andreas-timm/config`, validated by a Zod schema. Use whenever a Bun project needs typed configuration loading from `global.toml` and `local.toml` or a similar ordered file list with merge and schema validation.
---
# Bun Config With `@andreas-timm/config`

Use this skill when a Bun project needs typed, layered configuration loaded from TOML files and validated with Zod.

## Install

```sh
bun add @andreas-timm/config zod
```

## tsconfig.json

```jsonc
{
    "compilerOptions": {
        "types": ["bun"],
        "paths": {
            "@config": ["./src/config.ts"]
        }
    }
}
```

- `types: ["bun"]` is required for `Bun.file` and `Bun.TOML`.
- The `@config` alias keeps imports stable across the project.

## Config Module

Create `src/config.ts` that defines the schema and exports `loadConfig`:

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

## Usage

```ts
import { loadConfig } from "@config";

const config = await loadConfig();
```

## Behavior

- Files are read in order and deep-merged with `lodash.merge`; later files override earlier ones.
- Missing files are skipped silently.
- `root_dir` is injected automatically before schema parsing.
- Validation errors include the resolved file paths and per-issue details.
- `loadConfig()` caches the promise in module scope, so files are read and parsed only on the first call and concurrent callers share the in-flight load. Call `resetConfig()` to force a reload in tests or after editing a TOML file.
