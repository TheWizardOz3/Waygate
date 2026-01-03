'use client';

import { SettingsPage } from '@/components/features/settings/SettingsPage';

// Mock initial settings - in production this would come from an API call
const mockSettings = {
  id: 'tenant-123',
  name: 'John Doe',
  email: 'john@example.com',
  organization: 'Acme Corp',
  waygateApiKey: 'wg_live_abc123def456ghi789jkl012mno345pqr678',
  notificationsEnabled: true,
  webhookUrl: '',
};

export default function SettingsRoute() {
  // In production, use a hook like useSettings() to fetch from API
  return <SettingsPage initialSettings={mockSettings} />;
}
