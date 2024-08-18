// Config 2.0.2-node

import { readFileSync, writeFileSync, existsSync, statSync, utimesSync, mkdirSync } from 'node:fs'
import { load } from 'js-yaml'
import Ajv from 'ajv'
import * as tsj from 'ts-json-schema-generator'
import path from 'node:path'
import deepmerge from 'deepmerge'
import crypto from 'crypto'
import { type Config } from './index'

const DEFAULT_CONFIG_PATHS = ['config.yaml', 'config/project.yaml', 'local.yaml']
const DEFAULT_CACHE_DIR = 'node_modules/.cache/config'
const DEFAULT_CACHE_SCHEMA_PATH = `${DEFAULT_CACHE_DIR}/schema.json`
const DEFAULT_TSCONFIG_PATH = 'tsconfig.json'

const ajv = new Ajv({ allErrors: true })

function getCached(cachePath: string, mtimeMs?: number): Record<string, any> | null {
    let is_exists = existsSync(cachePath)
    if (mtimeMs !== undefined) {
        is_exists &&= statSync(cachePath).mtimeMs == mtimeMs
    }
    if (is_exists) {
        return JSON.parse(readFileSync(cachePath).toString('utf-8'))
    }
    return null
}

function writeToCache(cachePath: string, data: Record<string, any>, configDMDate?: Date) {
    const dataString = JSON.stringify(data)
    const cacheDir = path.dirname(cachePath)
    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true })
    }
    writeFileSync(cachePath, dataString)

    if (configDMDate !== undefined) {
        utimesSync(cachePath, configDMDate, configDMDate)
    }
}

function getSchema(interfaceName: string, interfacePath: string) {
    let schema: any

    let cached = getCached(DEFAULT_CACHE_SCHEMA_PATH, statSync(interfacePath).mtimeMs)
    if (cached !== null) {
        return cached as Config satisfies Config
    }

    const config = {
        path: interfacePath,
        tsconfig: DEFAULT_TSCONFIG_PATH,
        type: interfaceName,
    }
    schema = tsj.createGenerator(config).createSchema(config.type)

    writeToCache(DEFAULT_CACHE_SCHEMA_PATH, schema, new Date(statSync(interfacePath).mtimeMs))

    return schema
}

export function configValidate(data: Config) {
    const schema = getSchema(data.config.default_interface.name, data.config.default_interface.path)
    const validate = ajv.compile(schema)

    if (!validate(data)) {
        const validateMessages = validate.errors
            ?.map((i) => `  • ${i.message}: ${JSON.stringify(i.params)} (${i.instancePath}${i.schemaPath})`)
            .join('\n')
        throw new Error(`Config:\n${validateMessages}`)
    }
}

// // TODO: workaround due to bun issues:
// // - https://github.com/oven-sh/bun/issues/7584
// // - https://github.com/oven-sh/bun/issues/7630
// // - https://github.com/oven-sh/bun/issues/4746
// // TODO: replace after a fix "getGSMConfigFromManager"
// export async function getGSMConfig(config: Config): Promise<Record<string, any> | null> {
//     if (!config.config.gsm || config.config.gsm.secret == '') {
//         return null
//     }
//
//     // prettier-ignore
//     const gcloudSecret = spawnSync('gcloud', [
//         `--project=${config.config.gsm.project}`,
//         'secrets', 'versions', 'access', 'latest',
//         `--secret=${config.config.gsm.secret}`,
//     ], {encoding: 'utf8'}).stdout.trim()
//     const content = await new Response(gcloudSecret).text()
//     return JSON.parse(content)
// }

// // TODO: remove "noinspection" after the fix
// async function getGSMConfigFromManager(config: Config) {
//   if (config.config.gsm.secret == '') {
//     return config
//   }
//
//   const client = new SecretManagerServiceClient({})
//   const [res] = await client.accessSecretVersion({
//     name: `projects/${config.config.gsm.project}/secrets/${config.config.gsm.secret}/versions/latest`,
//   })
//
//   return res.payload && res.payload.data ? deepmerge(config, JSON.parse(res.payload.data.toString())) : config
// }

export function getData(configPaths: string[]) {
    const contents = configPaths
        .filter((p) => existsSync(p))
        .map((configPath) => readFileSync(configPath).toString('utf-8'))
        .filter((content) => content.length > 0)
    return contents.reduce((acc, content) => deepmerge(acc, load(content) as object), {}) as Config
}

function getConfigFilesModifiedHash(
    configPaths: string[],
    data: Record<string, any>,
    interfacePaths?: string[],
): `0x${string}` {
    const filesToCheck = [
        ...configPaths,
        ...(data.config?.added?.length > 0 ? data.config.added : []),
        ...(interfacePaths ?? []),
    ]
    const modified = filesToCheck.map((path) => (existsSync(path) ? statSync(path).mtimeMs.toString() : ''))
    const hash = crypto.createHash('sha256').update(modified.join(',')).digest('hex')
    return `0x${hash}`
}

export function getConfig<T>(configPaths: string[] = [], initData: { root_dir?: string } = {}): Config & T {
    if (configPaths.length == 0) {
        configPaths.push(...DEFAULT_CONFIG_PATHS)
    }

    if (initData.root_dir === undefined) {
        initData.root_dir = path.resolve(process.cwd())
    }

    let data = deepmerge(initData, getData(configPaths)) as Config & T
    const hash = getConfigFilesModifiedHash(configPaths, data)

    const cachePath = `${DEFAULT_CACHE_DIR}/interface.json`
    const cached = getCached(cachePath)
    if (cached !== null && cached.cache?.hash === hash) {
        return cached as Config & T
    }

    if (data.config?.added?.length > 0) {
        data = deepmerge(data, getData(data.config.added)) as Config & T
    }

    data.debug = process.env.DEBUG === 'true'
    data.cache = { ...(data.cache ?? {}), hash }

    configValidate(data)

    writeToCache(cachePath, data)

    return data
}
