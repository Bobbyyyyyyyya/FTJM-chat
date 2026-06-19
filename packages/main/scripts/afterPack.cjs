const { execSync } = require('child_process')

exports.default = async function(context) {
  if (process.platform !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  const identity = 'B453ECCBF27AAC9DB79529E260B23EAF34EEB94F'

  try {
    execSync(`security find-identity -v -p codesigning 2>&1 | grep -q "${identity}"`, { stdio: 'pipe' })
    console.log('Signing with Apple Development cert:', identity)
    execSync(`codesign --force --deep -s "${identity}" "${appPath}"`, { stdio: 'inherit' })
  } catch {
    console.log('Dev cert not found — skipping code signing for:', appPath)
  }
}
