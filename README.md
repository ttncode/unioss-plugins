# ttnplugins

Claude Code plugins by **ttncode**.

## Plugins

### unioss-pipeline

An end-to-end ticket pipeline for UNIOSS projects. It automates the full development cycle through gated stages:

**Investigator → Planner → Coder → Reviewer → Tester**

Each stage requires approval before proceeding. Verification is powered by PHPUnit and Playwright.

#### Features

- **Gated pipeline** — stops for your approval at every stage transition
- **Automated investigation** — fetches and summarizes GitLab tickets
- **Implementation planning** — generates structured implementation plans with file-level change maps
- **Code review** — checks for security, style, correctness, and dead references
- **PHPUnit testing** — runs tests inside Docker containers
- **Playwright E2E** — browser-based UI verification via bundled MCP server
- **Environment doctor** — checks and guides dependency setup

## Installation

```
/plugin marketplace add https://github.com/ttncode/ttnplugins
/plugin install unioss-pipeline
/unioss-doctor
```

`/unioss-doctor` checks your environment and guides you through any missing dependencies.

## Usage

```
/unioss-pipeline <gitlab-ticket-url>
```

Example:

```
/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834
```

The pipeline prints its plan and stops for your approval at each gate.

## Requirements

| Dependency                | Required | Notes                         |
| ------------------------- | -------- | ----------------------------- |
| Node.js                   | Yes      | Runtime for hooks and scripts |
| jq                        | Yes      | JSON processing               |
| Docker                    | Yes      | Container runtime             |
| `mysql-unioss3` container | Yes      | Database                      |
| `php-unioss3` container   | Yes      | PHP runtime                   |
| `GITLAB_TOKEN` env var    | Yes      | GitLab API access             |

Run `/unioss-doctor` to check all dependencies at once.

## License

[MIT](LICENSE)
