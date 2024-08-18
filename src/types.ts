export interface Cache {
  hash: `0x${string}`
}

export interface ConfigParameters {
  added: string[]
  default_interface: {
    path: string
    name: string
  }
  gsm?: {
    project: string
    secret: string
  }
}

export interface Config {
  root_dir: string
  debug: boolean
  config: ConfigParameters
  cache?: Cache
}
