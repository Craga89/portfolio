**Public Worker (worker/src):**
- Requests from origins outside `ALLOWED`, or MCP requests that skip the protocol header checks
- Workers AI calls that bypass `budget.js`, or that run when D1 can't be read
- Rate limits that can be skipped (a missing limiter call, a key a client controls)
- Visitor data stored beyond what's documented: IP addresses, cookies, user agents, or logging
  when Do Not Track or Global Privacy Control is set
- Prompt injection from a question reaching tools or instructions, or the model being given
  more than the matched passages
- An MCP tool or WebMCP tool that writes or reaches anything beyond the site's own data

**Site:**
- Content-Security-Policy weakened (`unsafe-inline`, `unsafe-eval`, wildcards, new origins)
- HTML built from strings that include fetched or user-provided text (ask.sh answers,
  `live.json`, translations) without escaping

**CI:**
- Secrets (`CLOUDFLARE_API_TOKEN` and others) reachable from pull request workflows or printed
- Event fields (titles, branch names) interpolated into `run:` instead of passed through `env:`
