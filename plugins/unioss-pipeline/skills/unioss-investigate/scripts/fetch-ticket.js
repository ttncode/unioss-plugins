#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');


function getToken() {
	const home = os.homedir();
	if (home) {
		const p = path.join(home, '.zshrc.local');
		if (fs.existsSync(p)) {
			const m = fs.readFileSync(p, 'utf8').match(/export GITLAB_TOKEN=(.+)/);
			if (m) return m[1].trim();
		}
	}
	return process.env.GITLAB_TOKEN;
}

const ticketUrl = process.argv[2];
if (!ticketUrl) { console.error('Usage: fetch-ticket.js <GITLAB_URL>'); process.exit(1); }

const urlMatch = ticketUrl.match(/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/);
if (!urlMatch) { console.error('Invalid GitLab URL.'); process.exit(1); }

const host = `https://${urlMatch[1]}`;
const namespace = urlMatch[2];
const repoName = urlMatch[3]; // AdminPage | FrontEnd
const prefix = repoName === 'FrontEnd' ? 'FE' : 'AP';
const projectPath = `${namespace}/${repoName}`;
const iid = urlMatch[5];
const token = getToken();
if (!token) { console.error('GITLAB_TOKEN not found in env or ~/.zshrc.local'); process.exit(1); }

async function apiGet(endpoint) {
	const url = `${host}/api/v4/projects/${encodeURIComponent(projectPath)}/${endpoint}`;
	try {
		const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
		if (!res.ok) { console.error(`Failed to fetch: ${url} — HTTP ${res.status}`); return null; }
		return await res.json();
	} catch (e) {
		console.error(`Failed to fetch: ${url} — API request failed`);
		return null;
	}
}

(async () => {
console.log(`Fetching #${iid} from ${projectPath}...`);
const issue = await apiGet(`issues/${iid}`);
if (!issue || issue.message) { console.error('Fetch failed:', issue?.message ?? 'unknown'); process.exit(1); }

const notes = await apiGet(`issues/${iid}/notes?per_page=100`) || [];
const links = await apiGet(`issues/${iid}/links`) || [];

// Convert relative /uploads/ paths to absolute web URLs
// Format: https://gitlab.unioss.jp/-/project/:project_id/uploads/:hash/:filename
function absoluteImages(text) {
	if (!text) return '';
	return text.replace(
		/!\[([^\]]*)\]\(\/uploads\/([^)]+)\)/g,
		`![$1](${host}/-/project/${issue.project_id}/uploads/$2)`
	);
}

const description = absoluteImages(issue.description);
const userNotes = notes.filter(n => !n.system);

// ── Ticket Summary ─────────────────────────────────────────────────────────
let summary = `# GitLab Ticket Summary\n\n`;
summary += `## Basic Information\n\n| Item | Value |\n|---|---|\n`;
summary += `| Title | ${issue.title} |\n`;
summary += `| URL | ${issue.web_url} |\n`;
summary += `| State | ${issue.state} |\n`;
summary += `| Labels | ${issue.labels.map(l => `\`${l}\``).join(', ') || 'none'} |\n`;
summary += `| Author | ${issue.author?.name ?? 'Unknown'} |\n`;
summary += `| Assignees | ${issue.assignees?.map(a => a.name).join(', ') || 'None'} |\n`;
summary += `| Updated | ${issue.updated_at} |\n\n`;
summary += `## Description\n\n${description}\n\n`;

// Attachments
const imgRegex = /!\[([^\]]*)\]\((https:\/\/gitlab\.unioss\.jp\/-\/project\/[^)]+)\)/g;
const images = [];
let m;
while ((m = imgRegex.exec(description)) !== null) images.push(m);
if (images.length) {
	summary += `## Attachments\n\n| Alt | URL |\n|---|---|\n`;
	images.forEach(i => { summary += `| ${i[1] || 'image'} | ${i[2]} |\n`; });
	summary += '\n';
}

// Related issues
if (links.length) {
	summary += `## Related Issues\n\n| Title | URL | Type |\n|---|---|---|\n`;
	links.forEach(l => { summary += `| ${l.title} (#${l.iid}) | ${l.web_url} | ${l.link_type ?? 'related'} |\n`; });
	summary += '\n';
}

// Comments
if (userNotes.length) {
	summary += `## Comments\n\n| Author | Date | Body |\n|---|---|---|\n`;
	userNotes.forEach(n => {
		const body = absoluteImages(n.body).replace(/\n/g, ' ').substring(0, 400);
		summary += `| ${n.author?.name ?? 'Unknown'} | ${n.created_at.slice(0, 10)} | ${body} |\n`;
	});
	summary += '\n';
}

summary += `## Open Questions\n\nTBD\n\n## Developer Notes\n\nTBD\n`;

// ── Output paths ───────────────────────────────────────────────────────────
const pipelineDir = path.join(process.cwd(), '.walkthrough', '.pipeline', `${prefix}#${iid}`);
if (!fs.existsSync(pipelineDir)) fs.mkdirSync(pipelineDir, { recursive: true });

const rawPath = path.join(pipelineDir, 'RAW_TICKET_DATA.json');
const summaryPath = path.join(pipelineDir, 'TICKET_SUMMARY.md');

// ── Write files ────────────────────────────────────────────────────────────
fs.writeFileSync(rawPath, JSON.stringify({ fetched_at: new Date().toISOString(), issue, notes, links }, null, 2));
console.log(`Raw data  → ${rawPath}`);

fs.writeFileSync(summaryPath, summary);
console.log(`Summary   → ${summaryPath}`);
})();
