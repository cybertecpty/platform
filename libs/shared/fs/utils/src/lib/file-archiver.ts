import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';

// `archiver`'s types ship via `export =`, so named value imports (`{ create }`) aren't
// available — reference everything off the default import instead.
export type FileArchiveFormat = archiver.Format;

export type FileArchiveOptions = archiver.TarOptions | archiver.ZipOptions;

// Describes a single file to include in the archive
export interface FileArchiveSource {
  /**
   * The content of the file as a string, buffer, or stream
   */
  readonly content: string | Buffer | Readable;
  /**
   * Name of the file inside the archive
   */
  readonly name: string;
}

/**
 * Abstract base class for creating an archive from multiple sources.
 * Defines common behavior and interface for different output types (Buffer, Readable).
 */
export abstract class FileArchiver<T extends Buffer | Readable> {
  protected readonly sources: FileArchiveSource[] = [];

  /**
   * Optionally initialize with sources.
   * @param sources Initial files to add.
   */
  constructor(...sources: readonly FileArchiveSource[]) {
    this.addSources(...sources);
  }

  /**
   * Adds one or more sources to the archive.
   * @param sources Files to add.
   * @returns This instance (for chaining).
   */
  addSources(...sources: readonly FileArchiveSource[]): this {
    this.sources.push(...sources);

    return this;
  }

  /**
   * Creates an archive in the specified format.
   * Must be implemented by subclasses.
   */
  abstract archive(format: 'zip', options?: archiver.ZipOptions): Promise<T>;
  abstract archive(format: 'tar', options?: archiver.TarOptions): Promise<T>;
  abstract archive(format: FileArchiveFormat, options?: FileArchiveOptions): Promise<T>;

  /**
   * Creates a tar archive with maximum gzip compression by default.
   * @param options Optional tar-specific options; any field here (including `gzip` and
   *   `gzipOptions`) overrides the default.
   * @returns Archive as the output type defined by subclass.
   */
  async tar(options?: archiver.TarOptions): Promise<T> {
    const tarOptions: archiver.TarOptions = {
      gzip: true,
      ...options,
      gzipOptions: { level: 9, ...(options?.gzipOptions ?? {}) }
    };

    return this.archive('tar', tarOptions);
  }

  /**
   * Creates a zip archive with maximum compression by default.
   * @param options Optional zip-specific options; any field here (including `zlib`)
   *   overrides the default.
   * @returns Archive as the output type defined by subclass.
   */
  async zip(options?: archiver.ZipOptions): Promise<T> {
    const zipOptions: archiver.ZipOptions = {
      ...options,
      zlib: { level: 9, ...(options?.zlib ?? {}) }
    };

    return this.archive('zip', zipOptions);
  }

  /**
   * Creates an archiver piping into `outStream` with every source appended, wiring a
   * single error path: any archiver error destroys `outStream` with a wrapped error
   * (preserving the original via `cause`). Shared so both output strategies below get
   * identical cleanup instead of diverging. Returns `onError` alongside the archive so
   * a caller's own completion signal (e.g. `finalize()` rejecting) can route through the
   * same wrapper rather than surfacing a differently-shaped, unwrapped error.
   *
   * A `Readable` source is single-use: reusing this instance for a second `archive()`
   * call re-appends the same (now-drained) stream, which archiver.js would otherwise
   * accept silently and emit as an empty/truncated entry. Fail fast instead.
   */
  protected buildArchive(
    format: FileArchiveFormat,
    options: FileArchiveOptions | undefined,
    outStream: PassThrough
  ): { archive: ReturnType<typeof archiver.create>; onError: (err: unknown) => void } {
    const alreadyConsumed = this.sources.find(
      ({ content }) => content instanceof Readable && (content.readableEnded || content.destroyed)
    );

    if (alreadyConsumed) {
      throw new Error(
        `Cannot archive source "${alreadyConsumed.name}": its stream has already been consumed by a ` +
          'previous archive()/tar()/zip() call. Streamed sources are single-use — use string/Buffer ' +
          'content, or add a fresh stream, when archiving the same instance more than once.'
      );
    }

    const archive = archiver.create(format, options);
    const onError = (err: unknown): void => {
      outStream.destroy(new Error('Archiver error', { cause: err }));
    };
    const streamSources = this.sources
      .map(({ content }) => content)
      .filter((content): content is Readable => content instanceof Readable);

    // Neither `archive.on('error', ...)` nor an appended source's own `'error'` fires
    // on the success path, so both listeners would otherwise stay attached for the
    // instance's lifetime — pinning this call's `outStream` (and, for a buffered
    // archive, its accumulated bytes) alive via the closure for every source kept in
    // `this.sources`. Detach once this build reaches a terminal state either way.
    outStream.once('close', () => {
      archive.off('error', onError);
      streamSources.forEach(source => source.off('error', onError));
    });

    archive.on('error', onError);
    archive.pipe(outStream);

    // `archiver` pipes an appended stream internally without forwarding its own
    // `'error'` event (pipe() never forwards errors), so a broken source wouldn't
    // otherwise reach `archive`'s `'error'` handler above — listen on it directly.
    streamSources.forEach(source => source.once('error', onError));
    this.sources.forEach(({ content, name }) => archive.append(content, { name }));

    return { archive, onError };
  }
}

/**
 * Concrete implementation of FileArchiver that returns a complete archive as a Buffer.
 *
 * Buffers the whole archive in memory before resolving — simplest to use (write straight
 * to a file, attach to an email/response body, hash it, etc.) but memory cost scales with
 * archive size. Prefer this when sources are small/bounded and you need the complete
 * archive as a single value rather than a stream to pipe onward.
 */
export class FileBufferArchiver extends FileArchiver<Buffer> {
  async archive(format: FileArchiveFormat, options?: FileArchiveOptions): Promise<Buffer> {
    const outStream = new PassThrough();
    const chunks: Buffer[] = [];

    // Collect archive data into memory
    outStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const { archive, onError } = this.buildArchive(format, options, outStream);

    await new Promise<void>((resolve, reject) => {
      outStream.on('end', resolve);
      outStream.on('error', reject);
      // Routed through `onError` (not a raw `reject`) so a `finalize()` rejection that
      // isn't also observed as an `archive` `'error'` event still surfaces as the same
      // wrapped, cause-preserving shape as every other failure path.
      archive.finalize().catch(onError);
    });

    // Combine collected chunks into a single Buffer
    return Buffer.concat(chunks);
  }
}

/**
 * Concrete implementation of FileArchiver that returns a Readable stream of the archive.
 *
 * Resolves immediately with a stream that emits archive bytes as they're produced —
 * memory use stays bounded regardless of archive size, since nothing is buffered beyond
 * what the consumer hasn't yet read. Prefer this for large or unbounded sources, or
 * whenever the destination is itself a stream (an HTTP response, a file write stream,
 * upload to blob storage) so bytes can flow through without ever fully materializing.
 */
export class FileStreamArchiver extends FileArchiver<Readable> {
  // Deliberately not `async`: `buildArchive` can throw synchronously (e.g. a reused,
  // already-drained stream source), and this method must still surface that as a
  // rejected promise rather than a synchronous throw, matching `FileBufferArchiver`'s
  // contract (and the shared `abstract archive()` signature) — hence the explicit
  // try/catch instead of relying on `async` to do it (an `async` method with no
  // `await` fails this workspace's `require-await` lint rule).
  archive(format: FileArchiveFormat, options?: FileArchiveOptions): Promise<Readable> {
    try {
      const outStream = new PassThrough();
      const { archive, onError } = this.buildArchive(format, options, outStream);

      // A `PassThrough` buffers internally regardless of when a consumer starts
      // reading, so `finalize()` need not wait for the caller to attach anything.
      archive.finalize().catch(onError);

      return Promise.resolve(outStream);
    } catch (err) {
      // Every synchronous throw reaching here is one raised ourselves (buildArchive's
      // reused-stream validation) or from `archiver.create()`, both conventionally
      // Error instances — an `instanceof` narrowing here would add an uncoverable
      // "was somehow not an Error" branch for a case that can't occur in practice.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- see comment above
      return Promise.reject(err);
    }
  }
}
