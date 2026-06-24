import JavaScriptObfuscator from 'javascript-obfuscator'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const dirs = [
  'packages/web/dist',
  'packages/main/dist',
]

const options = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: true,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
}

function findJsFiles(dir) {
  const files = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        files.push(...findJsFiles(full))
      } else if (extname(full) === '.js') {
        files.push(full)
      }
    }
  } catch {}
  return files
}

for (const dir of dirs) {
  const files = findJsFiles(dir)
  console.log(`Obfuscating ${files.length} files in ${dir}...`)
  for (const file of files) {
    const code = readFileSync(file, 'utf-8')
    const result = JavaScriptObfuscator.obfuscate(code, options)
    writeFileSync(file, result.getObfuscatedCode(), 'utf-8')
    console.log(`  ✓ ${file.replace(dir, '')}`)
  }
}

console.log('Obfuscation complete!')
