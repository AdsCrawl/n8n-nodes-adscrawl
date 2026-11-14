const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AdscrawlApi } = require('../dist/credentials/AdscrawlApi.credentials.js');
const { AdsCrawl } = require('../dist/nodes/Adscrawl/Adscrawl.node.js');
const {
  buildExtractPayload,
  parseAdsCrawlResponse,
  safeHttpErrorDetails,
  validateTargetUrl,
} = require('../dist/nodes/Adscrawl/helpers.js');

function createContext(parameters, responder, continueOnFail = false) {
  const requests = [];
  const context = {
    getInputData() {
      return parameters.map(() => ({ json: {} }));
    },
    getNodeParameter(name, itemIndex, defaultValue) {
      return parameters[itemIndex][name] ?? defaultValue;
    },
    getNode() {
      return {
        name: 'AdsCrawl',
        type: 'n8n-nodes-adscrawl.adsCrawl',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      };
    },
    continueOnFail() {
      return continueOnFail;
    },
    helpers: {
      async httpRequestWithAuthentication(credentialName, options) {
        requests.push({ credentialName, options });
        return responder(credentialName, options, requests.length - 1);
      },
    },
  };
  return { context, requests };
}

test('accepts public HTTP(S) targets and removes fragments', () => {
  assert.equal(
    validateTargetUrl('https://example.com/story?view=full#section'),
    'https://example.com/story?view=full',
  );
  assert.equal(validateTargetUrl('http://example.com/'), 'http://example.com/');
});

test('rejects unsupported schemes, embedded credentials, non-standard ports, and local targets', () => {
  for (const url of [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'https://user:password@example.com/',
    'https://example.com:8080/',
    'http://localhost/',
    'http://127.0.0.1/',
    'http://10.0.0.4/',
    'http://169.254.169.254/',
    'http://172.16.0.1/',
    'http://192.168.1.8/',
    'http://100.64.0.1/',
    'http://[::]/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[febf::1]/',
    'http://[::ffff:7f00:1]/',
  ]) {
    assert.throws(() => validateTargetUrl(url));
  }
});

test('builds only documented fields and nests viewport dimensions', () => {
  assert.deepEqual(
    buildExtractPayload('https://example.com/article', 'json', {
      selector: 'main article',
      waitUntil: 'domcontentloaded',
      timeoutMs: '45000',
      countryCode: 'SG',
      locale: 'en-SG',
      timezoneId: 'Asia/Singapore',
      viewportWidth: '1440',
      viewportHeight: 900,
    }),
    {
      url: 'https://example.com/article',
      contentMode: 'json',
      selector: 'main article',
      countryCode: 'SG',
      locale: 'en-SG',
      timezoneId: 'Asia/Singapore',
      waitUntil: 'domcontentloaded',
      timeoutMs: 45000,
      viewport: { width: 1440, height: 900 },
    },
  );
  assert.deepEqual(buildExtractPayload('https://example.com', 'html'), {
    url: 'https://example.com/',
    contentMode: 'html',
  });
});

test('rejects unsupported content modes, timeouts, and incomplete viewport pairs', () => {
  assert.throws(() => buildExtractPayload('https://example.com', 'xml'), /Content mode/);
  assert.throws(
    () => buildExtractPayload('https://example.com', 'html', { timeoutMs: 3600001 }),
    /Timeout/,
  );
  assert.throws(
    () => buildExtractPayload('https://example.com', 'html', { viewportWidth: 1280 }),
    /both viewport/,
  );
  assert.throws(
    () => buildExtractPayload('https://example.com', 'html', { waitUntil: 'idle' }),
    /Wait until/,
  );
});

test('preserves HTML/Markdown text and parses JSON article objects', () => {
  assert.equal(parseAdsCrawlResponse('<main>page</main>', 'html'), '<main>page</main>');
  assert.equal(parseAdsCrawlResponse('# Article', 'markdown'), '# Article');
  assert.deepEqual(parseAdsCrawlResponse('{"title":"Article"}', 'json'), { title: 'Article' });
  assert.throws(() => parseAdsCrawlResponse('not json', 'json'), /invalid JSON/);
  assert.throws(() => parseAdsCrawlResponse('[]', 'json'), /unexpected format/);
});

test('extracts only safe HTTP status and error code fields', () => {
  assert.deepEqual(
    safeHttpErrorDetails({
      httpCode: '402',
      message: 'secret=should-not-escape',
      response: { data: { code: 'INSUFFICIENT_CREDITS', apiKey: 'private' } },
    }),
    { statusCode: 402, code: 'INSUFFICIENT_CREDITS' },
  );
});

test('credential uses a password field and the authenticated template-catalog test endpoint', () => {
  const credential = new AdscrawlApi();
  assert.equal(credential.name, 'adscrawlApi');
  assert.deepEqual(credential.icon, {
    light: 'file:../nodes/Adscrawl/adscrawl.svg',
    dark: 'file:../nodes/Adscrawl/adscrawl.dark.svg',
  });
  assert.equal(credential.properties[0].typeOptions.password, true);
  assert.equal(credential.authenticate.properties.headers['x-api-key'], '={{$credentials.apiKey}}');
  assert.equal(credential.test.request.method, 'GET');
  assert.equal(credential.test.request.url, 'https://api.adscrawl.net/spa-extract/templates');
});

test('sends one authenticated HTML request and returns text without exposing credentials', async () => {
  const { context, requests } = createContext(
    [{
      url: 'https://example.com/article',
      contentMode: 'markdown',
      options: { waitUntil: 'domcontentloaded' },
    }],
    async () => '# Article\n\nReadable text',
  );

  const output = await AdsCrawl.prototype.execute.call(context);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].credentialName, 'adscrawlApi');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.url, 'https://api.adscrawl.net/html');
  assert.equal(requests[0].options.json, false);
  assert.equal(requests[0].options.encoding, 'text');
  assert.equal(requests[0].options.headers['x-api-key'], undefined);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    url: 'https://example.com/article',
    contentMode: 'markdown',
    waitUntil: 'domcontentloaded',
  });
  assert.deepEqual(output, [[{
    json: { contentMode: 'markdown', result: '# Article\n\nReadable text' },
    pairedItem: { item: 0 },
  }]]);
});

test('returns structured JSON response and keeps one output per input item', async () => {
  const { context } = createContext(
    [
      { url: 'https://example.com/a', contentMode: 'json', options: {} },
      { url: 'https://example.com/b', contentMode: 'html', options: {} },
    ],
    async (_credentialName, _options, index) => index === 0
      ? '{"title":"A","textContent":"First"}'
      : '<p>Second</p>',
  );

  const output = await AdsCrawl.prototype.execute.call(context);
  assert.deepEqual(output[0][0].json, {
    contentMode: 'json',
    result: { title: 'A', textContent: 'First' },
  });
  assert.deepEqual(output[0][1].json, { contentMode: 'html', result: '<p>Second</p>' });
  assert.deepEqual(output[0].map((item) => item.pairedItem), [{ item: 0 }, { item: 1 }]);
});

test('does not call AdsCrawl when URL validation fails', async () => {
  const { context, requests } = createContext(
    [{ url: 'file:///etc/passwd', contentMode: 'html', options: {} }],
    async () => '<never called>',
  );
  await assert.rejects(AdsCrawl.prototype.execute.call(context), /HTTP or HTTPS/);
  assert.equal(requests.length, 0);
});

test('continue-on-fail returns safe HTTP diagnostics but not raw error data', async () => {
  const { context } = createContext(
    [{ url: 'https://example.com', contentMode: 'html', options: {} }],
    async () => {
      throw {
        httpCode: '402',
        message: 'apiKey=do-not-return',
        response: { data: { code: 'INSUFFICIENT_CREDITS', token: 'do-not-return' } },
      };
    },
    true,
  );

  const output = await AdsCrawl.prototype.execute.call(context);
  assert.deepEqual(output[0][0].json, {
    error: 'AdsCrawl rejected the request because the account has insufficient credits.',
    statusCode: 402,
    code: 'INSUFFICIENT_CREDITS',
  });
  assert.doesNotMatch(JSON.stringify(output), /do-not-return/);
});
