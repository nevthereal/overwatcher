// In development the app runs inside node_modules/electron's stock Electron.app, so macOS shows
// "Electron" in the menu bar, Dock and Cmd-Tab. This renames that bundle to Overwatcher and gives
// it our icon. Packaged builds get the name and icon from electron-builder instead.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, utimesSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') process.exit(0)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pathFile = join(root, 'node_modules/electron/path.txt')
if (!existsSync(pathFile)) process.exit(0) // Electron binary not downloaded yet

const app = join(root, 'node_modules/electron/dist', readFileSync(pathFile, 'utf8').trim().split('/Contents/')[0])
const plist = join(app, 'Contents/Info.plist')
const NAME = 'Overwatcher'

const icon = join(root, 'resources/icon.icns')
const bundleIcon = join(app, 'Contents/Resources/electron.icns')
const current = execFileSync('plutil', ['-extract', 'CFBundleName', 'raw', plist], { encoding: 'utf8' }).trim()
if (current === NAME && readFileSync(icon).equals(readFileSync(bundleIcon))) process.exit(0)

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
	execFileSync('plutil', ['-replace', key, '-string', NAME, plist])
}
copyFileSync(icon, bundleIcon)

// Nudge Launch Services so the new name and icon are picked up.
const now = new Date()
utimesSync(app, now, now)
console.log(`Renamed the development Electron.app to ${NAME}`)
