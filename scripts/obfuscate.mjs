import JavaScriptObfuscator from 'javascript-obfuscator'
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
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
  stringArrayEncoding: 'rc4',
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
    if (!existsSync(dir)) return files
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        files.push(...findJsFiles(full))
      } else if (extname(full) === '.js') {
        files.push(full)
      }
    }
  } catch (e) {
    console.warn(`Warning: could not read ${dir}:`, e.message)
  }
  return files
}

for (const dir of dirs) {
  const files = findJsFiles(dir)
  if (files.length === 0) {
    console.log(`No JS files found in ${dir}, skipping...`)
    continue
  }
  console.log(`Obfuscating ${files.length} files in ${dir}...`)
  let success = 0
  for (const file of files) {
    try {
      const code = readFileSync(file, 'utf-8')
      const result = JavaScriptObfuscator.obfuscate(code, options)
      writeFileSync(file, result.getObfuscatedCode(), 'utf-8')
      console.log(`  ✓ ${file.replace(dir, '')}`)
      success++
    } catch (e) {
      console.warn(`  ✗ Failed to obfuscate ${file.replace(dir, '')}: ${e.message}`)
      console.warn(`    Keeping original file.`)
    }
  }
  console.log(`  ${success}/${files.length} files obfuscated`)
}

console.log('Obfuscation complete!')
