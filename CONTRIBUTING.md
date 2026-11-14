# Contributing

Thanks for helping improve the AdsCrawl community node. Keep changes focused on the AdsCrawl API and preserve the package's privacy and billing safeguards.

## Before submitting a change

- Read the [n8n community-node building guide](https://docs.n8n.io/integrations/community-nodes/building-community-nodes/) and its [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/).
- Keep this package focused on one third-party service. Do not add a generic workflow template, unrelated integrations, or undocumented AdsCrawl endpoints.
- Never commit an API key, exported workflow containing credentials, or live customer/page data. Tests must use mocks and must not contact AdsCrawl or target websites.
- Keep runtime code free of environment-variable and filesystem access; n8n manages credentials through its encrypted credential store.

## Local checks

Use the pinned pnpm version from `package.json` and run:

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
pnpm pack --dry-run
```

`pnpm run test` builds the distributable package and runs the mock-only suite. It verifies request mapping, target URL validation, response normalization, credential configuration, and safe error handling. It does not validate live credentials or production service behavior.

## Release policy

A release requires an AdsCrawl-owned public GitHub repository, a matching npm package identity, and GitHub Actions trusted publishing with npm provenance. Do not use or add a long-lived npm token. Release tags must match the version in `package.json`; update `CHANGELOG.md` with the verified release notes. n8n Cloud verification and directory listing are separate review steps handled through n8n's Creator Portal, not by opening an arbitrary code PR in the n8n repository.

Do not run `pnpm run release` until the repository, npm Trusted Publisher, and release permissions have been configured by the package owner. A successful local build or CI run does not mean the package has been published or verified by n8n.
