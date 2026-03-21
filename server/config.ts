function parseLogLevel(
  value: string | undefined,
): 'debug' | 'info' | 'warn' | 'error' {
  const v = value ?? 'info';
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') {
    return v;
  }
  return 'info';
}

export const config = {
  port: Number(process.env.PORT) || 3002,
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  logBufferSize: Number(process.env.LOG_BUFFER_SIZE) || 5000,
  reconnectIntervalMs: 5000,
  tailLines: 100,
};
