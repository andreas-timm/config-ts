# Config

## Features
- Native Typescript with Bun
- Typed config check
- Cache

## Usage

**Minimal example:**
- [`src/test.ts`](./src/test.ts)
- [`src/test_types.ts`](./src/test_types.ts)
- [`config/project.yaml`](./config/project.yaml)
- [`config/project_data.yaml`](./config/project_data.yaml)

**Predefined config files:**
- `config.yaml`
- `config/project.yaml`
- `local.yaml`

## Secure and sensitive data
Use external services for such information  
👷‍♂️✋⚠️  
Do not save sensitive information to a file in the repository, even if it in the gitignore file.  
⚠️ 🙅

**Examples:**
- local: `gpg`/`pass`,
- cloud: GSM (Google Secret Manager).

## License
[![CC BY 4.0][cc-by-shield]][cc-by]

This work is licensed under a [Creative Commons Attribution 4.0 International License][cc-by].

[![CC BY 4.0][cc-by-image]][cc-by]

[cc-by]: http://creativecommons.org/licenses/by/4.0/
[cc-by-image]: https://i.creativecommons.org/l/by/4.0/88x31.png
[cc-by-shield]: https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg

- [LICENSE](https://github.com/andreas-timm/config-ts/blob/main/LICENSE)
- Author: Andreas Timm
