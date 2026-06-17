const { execSync } = require('child_process')

exports.default = async function(context) {
  if (process.platform !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log('Ad-hoc signing:', appPath)
  execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' })
}
