export function soloSaveFolder(dataRoot: string, dbPath: string): string {
  const path = dbPath.trim()
  if (!/[\\/]game\.db$/i.test(path)) return dataRoot
  return path.replace(/[\\/]game\.db$/i, '')
}
