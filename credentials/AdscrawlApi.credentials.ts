import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  Icon,
  INodeProperties,
} from 'n8n-workflow';

export class AdscrawlApi implements ICredentialType {
  name = 'adscrawlApi';

  displayName = 'AdsCrawl API';

  documentationUrl = 'https://github.com/AdsCrawl/n8n-nodes-adscrawl#credentials';

  icon: Icon = {
    light: 'file:../nodes/Adscrawl/adscrawl.svg',
    dark: 'file:../nodes/Adscrawl/adscrawl.dark.svg',
  };

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      required: true,
      default: '',
      description: 'Your AdsCrawl API key. n8n encrypts saved credentials.',
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      method: 'GET',
      url: 'https://api.adscrawl.net/spa-extract/templates',
    },
  };

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'x-api-key': '={{$credentials.apiKey}}',
      },
    },
  };
}
