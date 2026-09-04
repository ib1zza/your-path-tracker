import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = 'your-path-tracker';
const domainsToAdd = ['localhost', '127.0.0.1', 'your-path-tracker.vercel.app'];

const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens?.refresh_token;

if (!refreshToken) {
  console.error('Firebase CLI is not authenticated. Run: npx firebase-tools@latest login');
  process.exit(1);
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});

if (!tokenResponse.ok) {
  console.error(
    'Failed to refresh Firebase CLI token. Run: npx firebase-tools@latest login --reauth',
  );
  process.exit(1);
}

const { access_token: accessToken } = await tokenResponse.json();

const configResponse = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-user-project': projectId,
    },
  },
);

if (!configResponse.ok) {
  console.error('Failed to read auth config:', configResponse.status, await configResponse.text());
  process.exit(1);
}

const currentConfig = await configResponse.json();
const currentDomains = currentConfig.authorizedDomains ?? [];
const nextDomains = [...new Set([...currentDomains, ...domainsToAdd])];

const patchResponse = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': projectId,
    },
    body: JSON.stringify({ authorizedDomains: nextDomains }),
  },
);

if (!patchResponse.ok) {
  console.error('Failed to update auth domains:', patchResponse.status, await patchResponse.text());
  process.exit(1);
}

const updated = await patchResponse.json();
console.log('Authorized domains:', updated.authorizedDomains.join(', '));
