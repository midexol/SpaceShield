import fs from 'node:fs'
import ts from 'typescript'
import nextra from 'nextra'

// Ensure ts.sys exists for twoslash in Next.js build environment
if (ts && (!ts.sys || !ts.sys.readFile)) {
  ts.sys = {
    args: [],
    newLine: '\n',
    useCaseSensitiveFileNames: true,
    write(s) { console.log(s) },
    writeOutputIsError: false,
    readFile(filePath, encoding) {
      try { return fs.readFileSync(filePath, encoding || 'utf8') } catch { return undefined }
    },
    getFileSize(filePath) {
      try { return fs.statSync(filePath).size } catch { return 0 }
    },
    writeFile(filePath, data) { fs.writeFileSync(filePath, data) },
    resolvePath(filePath) { return filePath },
    fileExists(filePath) { return fs.existsSync(filePath) },
    directoryExists(filePath) {
      try { return fs.statSync(filePath).isDirectory() } catch { return false }
    },
    createDirectory(filePath) { fs.mkdirSync(filePath, { recursive: true }) },
    getExecutingFilePath() { return '' },
    getCurrentDirectory() { return process.cwd() },
    getDirectories(filePath) {
      try { return fs.readdirSync(filePath).filter(f => fs.statSync(filePath + '/' + f).isDirectory()) } catch { return [] }
    },
    exit() {},
  }
}

const withNextra = nextra({
  defaultShowCopyCode: true,
})

export default withNextra({
  reactStrictMode: true,
  cleanDistDir: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
})
