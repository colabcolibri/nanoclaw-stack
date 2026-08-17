import fs from 'fs';
import path from 'path';

export async function getGoogleToken(cwd: string): Promise<string | null> {
  const candidatePaths = [
    path.join(cwd, 'google_tokens.json'),
    '/workspace/agent/google_tokens.json',
    '/opt/nanoclaw/groups/barao/google_tokens.json',
  ];
  let tokenFile = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      tokenFile = p;
      break;
    }
  }
  if (!tokenFile) return null;

  try {
    const data = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    if (data.access_token && data.expiry_date && data.expiry_date > Date.now() + 60000) {
      return data.access_token;
    }

    // Auto-refresh token
    if (data.refresh_token && data.client_id && data.client_secret) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: data.refresh_token,
          client_id: data.client_id,
          client_secret: data.client_secret,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const refreshed = (await res.json()) as any;
        data.access_token = refreshed.access_token;
        data.expiry_date = Date.now() + (refreshed.expires_in || 3600) * 1000;
        data.updated_at = new Date().toISOString();
        fs.writeFileSync(tokenFile, JSON.stringify(data, null, 2), 'utf-8');
        return data.access_token;
      }
    }
    return data.access_token || null;
  } catch {
    return null;
  }
}
