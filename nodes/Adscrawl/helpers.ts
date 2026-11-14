export type AdsCrawlContentMode = 'html' | 'markdown' | 'json';
export type AdsCrawlWaitUntil = 'domcontentloaded' | 'load' | 'networkidle';

export interface AdsCrawlExtractOptions {
  selector?: string;
  waitUntil?: AdsCrawlWaitUntil;
  timeoutMs?: number | string;
  countryCode?: string;
  locale?: string;
  timezoneId?: string;
  viewportWidth?: number | string;
  viewportHeight?: number | string;
}

const CONTENT_MODES = new Set<AdsCrawlContentMode>(['html', 'markdown', 'json']);
const WAIT_UNTIL_VALUES = new Set<AdsCrawlWaitUntil>([
  'domcontentloaded',
  'load',
  'networkidle',
]);
const MAX_TIMEOUT_MS = 3_600_000;

/** Validate a target URL against AdsCrawl's documented public HTTP(S) URL contract. */
export function validateTargetUrl(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    // eslint-disable-next-line @n8n/community-nodes/require-node-api-error -- The node wraps this pure validation error with its execution context.
    throw new Error('Enter a valid absolute URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must use HTTP or HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded credentials are not allowed.');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('AdsCrawl supports target URLs on ports 80 and 443 only.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '[::]' ||
    hostname.startsWith('[fc') ||
    hostname.startsWith('[fd') ||
    /^\[fe[89ab]/.test(hostname) ||
    hostname.startsWith('[::ffff:')
  ) {
    throw new Error('Use a public hostname; local and private targets are not supported.');
  }

  const octets = hostname.split('.').map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = octets;
    if (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127)
    ) {
      throw new Error('Use a public hostname; local and private targets are not supported.');
    }
  }

  parsed.hash = '';
  return parsed.toString();
}

/** Construct only documented AdsCrawl HTML endpoint fields; blank options are omitted. */
export function buildExtractPayload(
  url: string,
  contentMode: AdsCrawlContentMode,
  options: AdsCrawlExtractOptions = {},
): Record<string, unknown> {
  if (!CONTENT_MODES.has(contentMode)) {
    throw new Error('Content mode must be html, markdown, or json.');
  }

  const payload: Record<string, unknown> = {
    url: validateTargetUrl(url),
    contentMode,
  };

  const stringOptions: Array<keyof AdsCrawlExtractOptions> = [
    'selector',
    'countryCode',
    'locale',
    'timezoneId',
  ];
  for (const key of stringOptions) {
    const value = options[key];
    if (typeof value === 'string' && value.trim() !== '') {
      payload[key] = value.trim();
    }
  }

  if (options.waitUntil) {
    if (!WAIT_UNTIL_VALUES.has(options.waitUntil)) {
      throw new Error('Wait until must be domcontentloaded, load, or networkidle.');
    }
    payload.waitUntil = options.waitUntil;
  }

  if (options.timeoutMs !== undefined && options.timeoutMs !== '') {
    const timeoutMs = Number(options.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(`Timeout must be an integer from 1 to ${MAX_TIMEOUT_MS} milliseconds.`);
    }
    payload.timeoutMs = timeoutMs;
  }

  const width = options.viewportWidth === undefined || options.viewportWidth === ''
    ? undefined
    : Number(options.viewportWidth);
  const height = options.viewportHeight === undefined || options.viewportHeight === ''
    ? undefined
    : Number(options.viewportHeight);
  if ((width === undefined) !== (height === undefined)) {
    throw new Error('Set both viewport width and viewport height, or leave both empty.');
  }
  if (width !== undefined && height !== undefined) {
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
      throw new Error('Viewport width and height must be positive integers.');
    }
    payload.viewport = { width, height };
  }

  return payload;
}

/** Parse the API's JSON article response while preserving HTML/Markdown as text. */
export function parseAdsCrawlResponse(
  responseText: string,
  contentMode: AdsCrawlContentMode,
): string | Record<string, unknown> {
  if (contentMode !== 'json') return responseText;

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // eslint-disable-next-line @n8n/community-nodes/require-node-api-error -- The node wraps this pure parsing error with its execution context.
    throw new Error('AdsCrawl returned an invalid JSON response.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AdsCrawl returned JSON in an unexpected format.');
  }
  return parsed as Record<string, unknown>;
}

/** Extract only non-sensitive diagnostics from n8n's HTTP helper errors. */
export function safeHttpErrorDetails(error: unknown): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return {};
  const value = error as {
    httpCode?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown; data?: { code?: unknown } };
    code?: unknown;
  };

  const rawStatus = value.httpCode ?? value.statusCode ?? value.response?.status;
  const statusCode = typeof rawStatus === 'number'
    ? rawStatus
    : typeof rawStatus === 'string' && /^\d{3}$/.test(rawStatus)
      ? Number(rawStatus)
      : undefined;
  const rawCode = value.response?.data?.code ?? value.code;
  const code = typeof rawCode === 'string' && /^[A-Za-z0-9_]{2,80}$/.test(rawCode)
    ? rawCode
    : undefined;

  return {
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}
