// Composition root for Google Calendar: the client when GOOGLE_* env is set, else null
// (calendar sync off). Server only.
import 'server-only';
import { googleConfig } from '@/config/google';
import { createGoogleClient, type GoogleClient } from './calendar';

export function googleClient(): GoogleClient | null {
  const config = googleConfig();
  return config ? createGoogleClient(config) : null;
}
