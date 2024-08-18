import { getConfig } from './config'
import type {ConfigProject} from "./test_types";

console.time('getConfig')

const config = getConfig<ConfigProject>()

console.timeEnd('getConfig')

console.log('keys:')
Object.keys(config).forEach((key) => console.log(` - ${key}`))
