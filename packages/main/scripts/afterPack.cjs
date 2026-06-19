const { execSync } = require('child_process')

exports.default = async function(context) {
  if (process.platform !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log('Skipping ad-hoc signing for:', appPath)
}
