import {
  NodeConnectionTypes,
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';
import {
  buildExtractPayload,
  parseAdsCrawlResponse,
  safeHttpErrorDetails,
  type AdsCrawlContentMode,
  type AdsCrawlExtractOptions,
} from './helpers';

export class AdsCrawl implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AdsCrawl',
    name: 'adscrawl',
    icon: { light: 'file:adscrawl.svg', dark: 'file:adscrawl.dark.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["contentMode"]}}',
    description: 'Extract a public webpage. Each valid request consumes 1 AdsCrawl credit.',
    defaults: {
      name: 'AdsCrawl',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'adscrawlApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Extract Page',
            value: 'extract',
            action: 'Extract a webpage',
            description: 'Fetch a rendered public webpage as HTML, Markdown, or article JSON',
          },
        ],
        default: 'extract',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'https://example.com/article',
        description: 'Public HTTP or HTTPS page to render. Target ports 80 and 443 are supported.',
      },
      {
        displayName: 'Content Mode',
        name: 'contentMode',
        type: 'options',
        options: [
          { name: 'HTML', value: 'html', description: 'Return the rendered page HTML' },
          { name: 'Markdown', value: 'markdown', description: 'Return readable article Markdown' },
          { name: 'JSON', value: 'json', description: 'Return structured article data' },
        ],
        default: 'html',
        description: 'Markdown and JSON modes use AdsCrawl Readability extraction',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Country Code',
            name: 'countryCode',
            type: 'string',
            default: '',
            placeholder: 'US or GLOBAL',
            description: 'Optional managed residential proxy region',
          },
          {
            displayName: 'CSS Selector',
            name: 'selector',
            type: 'string',
            default: '',
            description: 'Wait for this CSS selector and limit extraction to the matching element',
          },
          {
            displayName: 'Locale',
            name: 'locale',
            type: 'string',
            default: '',
            placeholder: 'en-US',
            description: 'Optional browser locale, for example en-US or zh-CN',
          },
          {
            displayName: 'Timeout (Ms)',
            name: 'timeoutMs',
            type: 'number',
            typeOptions: { minValue: 1, maxValue: 3600000 },
            default: 30000,
            description: 'Maximum server-side task wait time. Leave unset to use the AdsCrawl default.',
          },
          {
            displayName: 'Timezone ID',
            name: 'timezoneId',
            type: 'string',
            default: '',
            placeholder: 'Asia/Singapore',
            description: 'Optional IANA timezone identifier',
          },
          {
            displayName: 'Viewport Height',
            name: 'viewportHeight',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 720,
            description: 'Set together with Viewport Width to override the rendered viewport',
          },
          {
            displayName: 'Viewport Width',
            name: 'viewportWidth',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 1280,
            description: 'Set together with Viewport Height to override the rendered viewport',
          },
          {
            displayName: 'Wait Until',
            name: 'waitUntil',
            type: 'options',
            options: [
              { name: 'Load', value: 'load' },
              { name: 'DOM Content Loaded', value: 'domcontentloaded' },
              { name: 'Network Idle', value: 'networkidle' },
            ],
            default: 'load',
            description: 'Navigation event to wait for. Network Idle may time out on long polling pages.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const outputItems: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
      const url = this.getNodeParameter('url', itemIndex) as string;
      const contentMode = this.getNodeParameter('contentMode', itemIndex) as AdsCrawlContentMode;
      const options = this.getNodeParameter('options', itemIndex, {}) as AdsCrawlExtractOptions;

      let requestBody: Record<string, unknown>;
      try {
        requestBody = buildExtractPayload(url, contentMode, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid AdsCrawl request parameters.';
        throw new NodeOperationError(this.getNode(), message, { itemIndex });
      }

      try {
        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'adscrawlApi',
          {
            method: 'POST',
            url: 'https://api.adscrawl.net/html',
            headers: {
              Accept: contentMode === 'json' ? 'application/json' : 'text/html, text/markdown;q=0.9',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            json: false,
            encoding: 'text',
          },
        );

        const responseText = typeof response === 'string' ? response : String(response ?? '');
        const result = parseAdsCrawlResponse(responseText, contentMode);
        outputItems.push({
          json: { contentMode, result },
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        const details = safeHttpErrorDetails(error);
        const safeMessage = details.statusCode === 402
          ? 'AdsCrawl rejected the request because the account has insufficient credits.'
          : details.statusCode === 401
            ? 'AdsCrawl rejected the API key. Check the AdsCrawl credential.'
            : 'AdsCrawl could not complete the page extraction. Check the status code and AdsCrawl API documentation.';
        if (this.continueOnFail()) {
          outputItems.push({
            json: { error: safeMessage, ...details },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), safeMessage, { itemIndex });
      }
    }

    return [outputItems];
  }
}
