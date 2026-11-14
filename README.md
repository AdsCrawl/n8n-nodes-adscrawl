# n8n-nodes-adscrawl

An independent n8n community node for calling AdsCrawl's `POST /html` API. It renders a public HTTP(S) page in AdsCrawl's hosted browser and returns HTML, readable Markdown, or structured article JSON.

This node is intentionally limited to page extraction. It does not expose browser clicking, form submission, persistent browser profiles, or a general-purpose CDP session.

> **Publication status:** The package source is prepared, but it is not yet published to npm or listed in n8n's community-node directory. Do not install it by package name until a release is announced.

## What it does

- Accepts one public page URL per input item and calls `POST https://api.adscrawl.net/html`.
- Supports `html`, `markdown`, and `json` content modes. Markdown and JSON use AdsCrawl's Readability extraction.
- Offers optional CSS selector, navigation wait condition, task timeout, managed proxy region, browser locale, timezone, and viewport settings.
- Emits one output item per input item as `{ "contentMode": "...", "result": ... }`. For HTML and Markdown, `result` is a string; for JSON, it is the parsed article object.
- Is marked usable as an n8n AI tool, so an AI Agent can call the extraction action when you explicitly attach and configure it.

## Installation

After this package is published, install `n8n-nodes-adscrawl` from **Settings → Community Nodes** in your n8n instance. Follow n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

For local development, clone this repository, install the development dependencies with `pnpm install --frozen-lockfile`, then run `pnpm run build`. The built `dist` package can be installed into a disposable self-hosted n8n test instance. This repository does not include a workflow template or a real API key.

## Credentials

Create an AdsCrawl API key in your AdsCrawl account, then select **AdsCrawl API** in the node's credentials field and enter the key. The credential is a password field; n8n stores saved credentials encrypted and the node sends the value only in the `x-api-key` request header. Do not put an API key in a workflow parameter, expression, URL, or exported workflow file.

When you test the credential, n8n calls the authenticated `GET /spa-extract/templates` endpoint, which returns built-in template metadata and does not start a page-render task. The AdsCrawl credits table lists extraction `POST` operations and running cloud browsers as credit-consuming operations; this catalog `GET` is not listed as billable. The first node execution calls `POST /html`, and each valid extraction request consumes one credit.

## Usage

1. Add **AdsCrawl** to a workflow and choose **Extract Page**.
2. Set a public `http://` or `https://` URL. AdsCrawl supports target ports 80 and 443; embedded URL usernames and passwords, localhost names, common private IP ranges, and IPv4-mapped IPv6 URLs are rejected before the request is sent.
3. Choose HTML, Markdown, or JSON. Set optional extraction or browser settings only when needed.
4. Connect the output to downstream nodes. For example, a Markdown result is available at `{{$json.result}}`; JSON article properties are available under `{{$json.result.title}}`, `{{$json.result.textContent}}`, and other returned fields.

Example input item (not a workflow template):

```json
{
  "url": "https://example.com/article",
  "contentMode": "markdown",
  "options": { "waitUntil": "domcontentloaded" }
}
```

The output item contains `contentMode` and `result`; in Markdown mode, `result` is the returned Markdown string. The example URL is illustrative and has not been used for a live API test.

The node sends only the corresponding documented `/html` fields. It does not send cookies, custom proxy credentials, custom user agents, fingerprint overrides, or arbitrary headers.

This node uses n8n's programmatic style so it can reject private/local target URLs before the request, normalize text versus JSON responses, and expose only sanitized API error details while still making one API request per input item.

## Credits, limits, and privacy

AdsCrawl consumes one credit after request validation and before a page-render task is enqueued. Each valid extraction request can therefore use one credit; using the node with multiple input items can create multiple billable requests. See AdsCrawl's [credits and limits](https://docs.adscrawl.net/credits-and-limits) and [`POST /html` API reference](https://docs.adscrawl.net/api-reference/html) before running a large workflow.

The API request URL and extracted page content can appear in n8n execution data according to your n8n execution-data settings. Review those settings and the destination site's access rules before processing sensitive pages. Use this node only for sites and content you are authorized to access.

## Compatibility and development

The package follows the n8n community-node package format and has no runtime dependencies beyond n8n's `n8n-workflow` peer dependency. The repository's tests use mocked n8n helpers and never call AdsCrawl or a target website; they do not verify live credentials or production service behavior.

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
```

n8n community nodes are third-party packages. This is an AdsCrawl-maintained integration, not a built-in n8n node, an n8n endorsement, or a verified/approved listing. Directory inclusion depends on n8n's own review process.

## Resources

- [AdsCrawl HTML API reference](https://docs.adscrawl.net/api-reference/html)
- [AdsCrawl template catalog API reference](https://docs.adscrawl.net/api-reference/spa-extract-templates)
- [AdsCrawl credits and limits](https://docs.adscrawl.net/credits-and-limits)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
