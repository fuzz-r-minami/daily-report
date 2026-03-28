/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.drepo.app',
  productName: 'drepo',
  artifactName: '${productName}-${version}.${ext}',
  publish: {
    provider: 'github',
    owner: 'fuzz-r-minami',
    repo: 'daily-report'
  },
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  files: ['out/**/*'],
  win: {
    icon: 'build/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'msi',  arch: ['x64'] },
      { target: 'zip',  arch: ['x64'] }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico'
  },
  msi: {
    oneClick: false,
    perMachine: false,
    runAfterFinish: true,
    additionalLightArgs: ['-cultures:ja-JP']
  }
}
