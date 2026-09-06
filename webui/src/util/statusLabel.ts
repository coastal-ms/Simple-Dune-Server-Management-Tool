const STATUS_LABELS: Readonly<Record<string, string>> = {
  running: 'Running', ready: 'Ready', starting: 'Starting', startup: 'Startup',
  stopped: 'Stopped', stopping: 'Stopping', pending: 'Pending', terminating: 'Terminating',
  unknown: 'Unknown', 'not ready': 'Not ready', 'not reported': 'Not reported',
  unavailable: 'Unavailable', failed: 'Failed', error: 'Error', online: 'Online',
  offline: 'Offline', disabled: 'Disabled', enabled: 'Enabled', connected: 'Connected',
  disconnected: 'Disconnected', healthy: 'Healthy', degraded: 'Degraded',
}

export function statusLabel(value: string) {
  const key = value.trim().toLowerCase()
  return Object.hasOwn(STATUS_LABELS, key) ? STATUS_LABELS[key] : value
}
