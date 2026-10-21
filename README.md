# SimSites for Claude Code, Codex and Cursor

Design a UI feature as short simulations (sims) of your app's real screens before building it: Claude draws them, you watch and approve them on one page (or refine them in the conversation), then Claude builds from the approved frames and verifies by replaying them in a real browser.

Your coding agent (Claude Code, Codex, Cursor) draws the sims; [SimSites](https://simsites.vercel.app) renders, checks, hosts and shares them, and is
where you and your team watch, comment and approve. This repo is the plugin (the `simsites` CLI, its skills and hooks)
and the GitHub Action that verifies pull requests.

## Install

In Claude Code:

```
/plugin marketplace add yannickErp/simsites-plugin
/plugin install simsites@simsites
```

Then, in your app's repo: `/simsites <the feature you want>`. The first time, it asks you to sign in
(`simsites auth`, a token from SimSites → Settings).

In Codex:

```
codex plugin marketplace add yannickErp/simsites-plugin
```

then install **SimSites** from `/plugins` and ask: "Use the simsites skill to design <the feature>".

In Cursor: Settings → Plugins → add `yannickErp/simsites-plugin` (or `/add-plugin` in the agent chat), then ask for the feature the same way.

Any other MCP client: run `npx -y github:yannickErp/simsites-plugin mcp` as a stdio server. It serves every `simsites` command as a
tool and the method as a prompt. Sign in once from a terminal: `npx -y github:yannickErp/simsites-plugin auth <token>`.

In ChatGPT or the Claude app (review, comment, approve and share from a chat): add the connector
`https://simsites.vercel.app/api/mcp` and sign in with GitHub.

## Verify pull requests (GitHub Action)

```yaml
# .github/workflows/simsites.yml
name: SimSites
on: deployment_status
jobs:
  verify:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.deployment.sha }}
      - uses: yannickErp/simsites-plugin/plugin/action@main
        with:
          token: ${{ secrets.SIMSITES_TOKEN }}
          dev-url: ${{ github.event.deployment_status.environment_url }}
```

More: [CI](https://github.com/yannickErp/simsites-plugin/blob/main/plugin/action/action.yml).

## Version

0.14.0. Needs Node 20+. Playwright installs itself into `~/.simsites/runner` the first time it's needed.

## License

Proprietary: you may install and use it with SimSites; all other rights reserved. See [LICENSE](LICENSE).
