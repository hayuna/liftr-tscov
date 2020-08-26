import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import glob from 'glob'
import { JsonConfig } from './types/json-config.type'

export function getTsConfigFilePath(project: string): {
  configFilePath: string;
  dirname: string;
} {
  let configFilePath: string
  let dirname: string
  const projectStats = fs.statSync(project)

  if (projectStats.isDirectory()) {
    configFilePath = path.resolve(project, 'tsconfig.json')
    dirname = project
  } else if (projectStats.isFile()) {
    configFilePath = project
    dirname = path.dirname(project)
  } else {
    throw new Error("parameter '-p' should be a file or directory.")
  }
  return { configFilePath, dirname }
}

export function getTsConfig(configFilePath: string, dirname: string): JsonConfig {
  const configResult = ts.readConfigFile(configFilePath, (p: any) => fs.readFileSync(p).toString())
  const config = configResult.error ? {
    compilerOptions: {
      lib: [
        'dom',
        'es5',
        'es2015',
        'es2016',
        'es2017'
      ],
      allowSyntheticDefaultImports: true
    }
  } : configResult.config as JsonConfig
  if (config.extends) {
    const project = path.resolve(dirname, config.extends)
    const { configFilePath, dirname: extendsBasename } = getTsConfigFilePath(project)
    const extendsConfig = getTsConfig(configFilePath, extendsBasename)
    config.compilerOptions = { ...extendsConfig.compilerOptions, ...config.compilerOptions }
  }
  return config
}

  // tslint:disable-next-line:cognitive-complexity
export async function getRootNames(config: JsonConfig, dirname: string): Promise<string[]> {
  const include: string[] | undefined = config.include
  const exclude: string[] | undefined = config.exclude || ['node_modules/**', '*.spec.ts', '*.test.ts']

  if (config.files) {
    return config.files.map(file => path.resolve(dirname, file))
  }
  if (include && Array.isArray(include) && include.length > 0) {
    const rules: string[] = []
    for (const file of include) {
      const currentPath = path.resolve(dirname, file)
      const stats = await stat(currentPath)
      if (stats === undefined) {
        rules.push(currentPath)
      } else if (stats.isDirectory()) {
        rules.push(`${currentPath.endsWith('/') ? currentPath.substring(0, currentPath.length - 1) : currentPath}/**/*.{ts,tsx}`)
      } else if (stats.isFile()) {
        rules.push(currentPath)
      }
    }
    return globLocal(rules.length === 1 ? rules[0] : `{${rules.join(',')}}`, exclude, dirname)
  }
  const rootNames = await globLocal(`**/*.{ts,tsx}`, exclude, dirname)
  return rootNames.map((rootName: string) => path.resolve(process.cwd(), dirname, rootName))
}

async function stat(file: string): Promise<fs.Stats | undefined> {
  return new Promise<fs.Stats | undefined>((resolve, reject) => {
    fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
      if (error) {
        reject(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

function globLocal(pattern: string, ignore: string | string[], cwd?: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, { ignore, cwd }, (error, matches) => {
      if (error) {
        reject(error)
      } else {
        resolve(matches)
      }
    })
  })
}
