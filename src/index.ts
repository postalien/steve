import Busboy from 'busboy';
import { Request, Response, NextFunction } from 'express';
import internal from 'stream';
import { Options } from './types';

const onFile = (
  req: Request,
  name: string,
  file: internal.Readable,
  info: Busboy.FileInfo,
): void => {
  const bufs: Array<Uint8Array> = [];

  file.on('data', (d: Uint8Array) => {
    bufs.push(d);
  });
  file.on('end', () => {
    const buffer = Buffer.concat(bufs);
    req.body[name] = {
      ...info,
      buffer,
    };
  });
};

const onField = (req: Request, name: string, value: string): void => {
  req.body[name] = value;
};

const defaultOptions: Options = {
  sizeLimit: 1024, // 1 MB
};

class Steve {
  private _options: Options;
  constructor(options: Options) {
    this._options = { ...defaultOptions, ...options };
  }

  get options() {
    return this._options;
  }

  process(req: Request, res: Response, next: NextFunction) {
    req.on('data', () => {
      if (req.socket.bytesRead > this.options.sizeLimit) {
        throw new Error('Payload too large. Stop receiving data');
      }
    });
    req.on('aborted', () => {
      next();
    });
    const bb = Busboy({ headers: req.headers });

    bb.on(
      'file',
      (name: string, file: internal.Readable, info: Busboy.FileInfo) =>
        onFile(req, name, file, info),
    );
    bb.on('field', (name: string, value: string) => onField(req, name, value));
    bb.on('finish', () => next());
    bb.on('error', error => {
      next(error);
    });
    return req.pipe(bb);
  }
}

const steve = (options: Options) => {
  if (options === undefined) {
    return new Steve({});
  }

  if (typeof options === 'object' && options !== null) {
    return new Steve(options);
  }

  throw new TypeError('Expected object for argument options');
};

export default steve;
