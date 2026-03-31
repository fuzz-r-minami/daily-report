# drepo

**English | [日本語](README.ja.md)**

A Windows desktop app that automatically collects work history from Git, SVN, Perforce, Jira, Redmine, Confluence, Slack, and Google Calendar to generate daily, weekly, and monthly reports.

**Languages:** 日本語 / English / 简体中文 / 繁體中文 / 한국어

---

## Output Example

After collection, the app produces Markdown text like the following. Use it as-is or let Claude AI rewrite it into natural prose.

```markdown
Hello,
This is my work report for 2026-03-28.

---

## Internal Business System

### Work Summary
- TBA

### History
#### Git Commits (3)
- [2026/03/28 11:42 | a1b2c3d | Fix: resolve pagination bug on search screen](https://github.com/example/repo/commit/a1b2c3d...)
- [2026/03/28 14:15 | e4f5g6h | Feat: add CSV export to user list](https://github.com/example/repo/commit/e4f5g6h...)
- [2026/03/28 17:03 | i7j8k9l | Refactor: consolidate API client](https://github.com/example/repo/commit/i7j8k9l...)

#### Redmine Tickets (2)
- [2026/03/28 14:20 | #1042 [In Progress] User list CSV export](https://redmine.example.com/issues/1042)
- [2026/03/28 17:05 | #987 [Resolved] Pagination bug on search screen](https://redmine.example.com/issues/987)

#### Slack Messages (2)
- [2026/03/28 10:31 | Will handle the export feature for #1042 today](https://slack.com/archives/...)
- [2026/03/28 16:58 | Fixed the pagination bug. Please review.](https://slack.com/archives/...)

#### Meetings (1)
- [2026/03/28 13:00 | Weekly team sync](https://calendar.google.com/...)

---

Thank you.
```

> **After Claude AI formatting**
>
> The "Work Summary — TBA" section is automatically written based on the collected history:
> ```
> ### Work Summary
> - Investigated and fixed the pagination bug (#987); sent for review today
> - Implemented CSV export for user list (#987) alongside API client consolidation
> - Shared progress at weekly team sync
> ```

---

## Features

- **Daily / Weekly / Monthly report generation** — Collect work history for a given period and build a report
- **Workload allocation** — Automatically calculate person-days per project for a given month
- **Claude AI formatting** — Rewrite raw history into natural prose using the Claude CLI
- **Email sending** — Open the report directly in your default mail client
- **Multilingual UI** — Japanese / English / 简体中文 / 繁體中文 / 한국어 (selected on first launch)
- **Auto-update** — Notifies you when a new version is available

---

## Getting Started

### Installation

1. Download the latest `drepo Setup x.x.x.exe` from [Releases](https://github.com/fuzz-r-minami/daily-report/releases) and install it
2. On first launch, select your language
3. Add a **Project**

### Quick Start

1. **Add a project** (left sidebar → Projects → + New)
2. Configure the integrations you use (Git / SVN / Perforce / Jira / Redmine / Confluence / Slack, etc.)
3. Go to the Dashboard, select a project and date range, and generate a report

---

## Project Settings

Each project can have multiple integration sources configured.

### Git

| Field | Description |
|-------|-------------|
| Local path | Path to your local repository folder |
| Branch | Target branch (e.g. `main`) |
| Auth | Personal Access Token for HTTPS; SSH uses your existing `~/.ssh/` keys automatically |

### SVN

| Field | Description |
|-------|-------------|
| Local path | Path to your local working copy |
| Repository URL | URL of the SVN repository |
| Username | Used to filter commits (authentication uses the SVN client's saved credentials) |

> SVN integration requires TortoiseSVN or a compatible SVN client.

### Perforce

| Field | Description |
|-------|-------------|
| Server (P4PORT) | Server address (e.g. `perforce:1666`) |
| Username | Your Perforce username |
| Depot path | Target depot path (e.g. `//depot/myproject/...`) |
| Password / ticket | Credentials |

> Perforce integration requires the p4 command-line client.

### Jira

| Field | Description |
|-------|-------------|
| Jira URL | URL of your Jira instance (e.g. `https://company.atlassian.net`) |
| Email / Username | Atlassian account email (Cloud) or username (Server) |
| API token | Found in your Atlassian account settings |
| Project key | Leave blank for all projects, or enter a specific key (e.g. `PROJ`) |
| Server / Data Center mode | Enable for self-hosted Jira instances |

Only issues you **created or updated** within the specified period are collected.

### Confluence

| Field | Description |
|-------|-------------|
| Confluence URL | URL of your Confluence instance (e.g. `https://company.atlassian.net`) |
| Email / Username | Atlassian account email (Cloud) or username (Server) |
| API token | Found in your Atlassian account settings |
| Space key | Leave blank for all spaces, or enter a specific key (e.g. `TEAM`) |
| Server / Data Center mode | Enable for self-hosted Confluence instances |

Only pages you **created or updated** within the specified period are collected.

### Slack

Tokens are managed per workspace. Multiple projects in the same workspace share one token.

**One-time setup (in Settings):**

1. Open Settings (⚙️) and click **"+ Add Workspace"** in the Slack section
2. Authorize the app in your browser
3. The workspace name appears in the list — you're done

**Per-project setup:**

1. In the project's **Slack tab**, enable Slack integration
2. Select the workspace from the dropdown
3. Enter channel IDs (comma-separated) and save

Only messages and thread replies posted by you are collected.

### Redmine

| Field | Description |
|-------|-------------|
| Redmine URL | URL of your Redmine server (e.g. `https://redmine.example.com`) |
| Project identifier | Leave blank for all projects, or enter a specific identifier |
| API access key | Found in Redmine under My Account |
| Basic auth | Only needed if a reverse proxy adds HTTP Basic authentication |

Only tickets you **created or updated** within the specified period are collected.

### Google Calendar

Register your Client ID and Client Secret in Settings (⚙️), then click "Sign in with Google" to complete the connection.

Events whose title contains the project name are collected. Declined and unanswered events are excluded.

### File Watch

Collects files modified under specified folders within the date range.

---

## Generating Reports

### Report Types

| Type | Description |
|------|-------------|
| 📅 Daily | Collects history for a single day |
| 📆 Weekly | Collects history for the 7 days ending on the selected date |
| 🗓 Monthly | Collects history for the entire selected month |
| 📊 Allocation | Calculates person-days per project for a month (no report text generated) |

### Workload Allocation

Days with activity in Git / SVN / Perforce / Jira / Redmine / Confluence / Slack / Google Calendar count as working days. When multiple projects have activity on the same day, each is credited 1/N of a day.

### Empty Project Exclusion

Projects with no data collected from any integration for the selected period are automatically omitted from the report.

---

## Preview and Send

Once collection is complete, the preview screen opens.

| Action | Description |
|--------|-------------|
| Edit subject | Edit the email subject directly in the preview |
| 🤖 Format with Claude | AI rewrites the work summary from the collected history (requires Claude setup) |
| ✏️ Edit / 👁 Preview | Edit the Markdown text directly |
| 📋 Copy | Copy the report to clipboard |
| 💾 Save | Save as a Markdown file |
| 📧 mailto: | Open your default mail client with the report pre-filled (hover the button to see recipients) |

---

## Templates

Report format is managed via templates (left sidebar → Templates).

| Field | Description |
|-------|-------------|
| Preamble | Text inserted at the top of the report |
| Postamble | Text inserted at the bottom |
| Subject template | Template for the email subject line |
| Recipients | Email addresses (one per line) |
| Claude system prompt | Instructions for the AI formatting step |

**Variables available in preamble / postamble:**

| Variable | Value | Report type |
|----------|-------|-------------|
| `{{date}}` | Date (e.g. `2026-03-28`) | Daily |
| `{{week_range}}` | Range (e.g. `2026-03-22 – 2026-03-28`) | Weekly |
| `{{month}}` | Month (e.g. `2026年3月`) | Monthly |

---

## Settings (⚙️)

### Language

A language selection dialog appears on first launch. You can change it any time in Settings.

### Claude AI Formatting

Uses the locally installed Claude CLI to rewrite collected data into prose. Enable "Claude formatting" in Settings.

### Slack

Tokens are obtained and managed per workspace via PKCE OAuth. You can add, remove, and test workspaces in Settings. See [Project Settings → Slack](#slack) for details.

### Google Calendar

Create an OAuth 2.0 Client ID in Google Cloud Console, enter the Client ID and Client Secret in Settings, then click "Sign in with Google" to complete setup. Step-by-step instructions are shown in the Settings screen.

### Data Directory

View or open the folder where collected data and saved reports are stored.

### Updates

The app checks for updates automatically at launch. Use the "Check for Updates" button for a manual check. When a new version is found, download it and click "Restart & Apply".

---

## Credential Storage

Passwords, API keys, and tokens are stored in the Windows Credential Manager — never in the settings file.

---

## Full Reset

Settings are stored in two places. Delete both to reset completely.

### 1. Delete the settings file

Open the following path in Explorer and delete `config.json`:

```
%APPDATA%\drepo
```

This resets all projects, templates, and Claude / Google Calendar settings.

### 2. Delete saved credentials

Open **Credential Manager** from the Start menu, go to the **Windows Credentials** tab, and delete all entries starting with `daily-report`.

This removes Git tokens, Slack tokens, Perforce passwords, Redmine API keys, and the Google Calendar refresh token.

> Deleting both returns the app to its initial state.
