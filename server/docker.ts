import http from 'node:http';
import { config } from './config.js';

export function dockerGet(path: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: config.dockerSocket, path, method: 'GET' },
      resolve,
    );
    req.on('error', reject);
    req.end();
  });
}

export function readBody(response: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    response.on('data', (chunk: string) => (body += chunk));
    response.on('end', () => resolve(body));
    response.on('error', reject);
  });
}

export function demuxDockerStream(
  response: http.IncomingMessage,
  onLine: (stream: 'stdout' | 'stderr', line: string) => void,
  onEnd: (error?: Error) => void,
): void {
  let buf = Buffer.alloc(0);

  response.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);

    while (buf.length >= 8) {
      const frameSize = buf.readUInt32BE(4);
      if (buf.length < 8 + frameSize) break;

      const streamType: 'stdout' | 'stderr' = buf[0] === 2 ? 'stderr' : 'stdout';
      const text = buf.subarray(8, 8 + frameSize).toString('utf-8');
      buf = buf.subarray(8 + frameSize);

      for (const line of text.split('\n')) {
        if (line.length > 0) {
          onLine(streamType, line);
        }
      }
    }
  });

  response.on('end', () => onEnd());
  response.on('error', (err: Error) => onEnd(err));
}
