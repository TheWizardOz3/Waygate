'use client';

import { useState } from 'react';
import { Settings, User, Bell, Shield, Palette, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiKeyDisplay } from './ApiKeyDisplay';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  organization: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface TenantSettings {
  id: string;
  name: string;
  email: string;
  organization?: string;
  waygateApiKey: string;
  notificationsEnabled: boolean;
  webhookUrl?: string;
}

interface SettingsPageProps {
  initialSettings?: TenantSettings;
  isLoading?: boolean;
}

export function SettingsPage({ initialSettings, isLoading }: SettingsPageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialSettings?.notificationsEnabled ?? false
  );

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialSettings?.name ?? '',
      email: initialSettings?.email ?? '',
      organization: initialSettings?.organization ?? '',
    },
  });

  const handleSaveProfile = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      await apiClient.patch('/settings/profile', data);
      toast.success('Profile updated successfully');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateApiKey = async (): Promise<string> => {
    const response = await apiClient.post<{ apiKey: string }>('/settings/api-key/regenerate');
    return response.apiKey;
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      await apiClient.patch('/settings/notifications', { enabled });
      toast.success(enabled ? 'Notifications enabled' : 'Notifications disabled');
    } catch (err) {
      setNotificationsEnabled(!enabled); // Revert on error
      const error = err instanceof Error ? err.message : 'Failed to update notifications';
      toast.error(error);
    }
  };

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <User className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Shield className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveProfile)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="organization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <FormControl>
                          <Input placeholder="Your company (optional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          This will be displayed in your integration credentials
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <div className="space-y-6">
            <ApiKeyDisplay
              apiKey={initialSettings?.waygateApiKey ?? 'wg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
              label="Waygate API Key"
              description="Use this key to authenticate requests from your applications to the Waygate Gateway API"
              onRegenerate={handleRegenerateApiKey}
            />

            <Card>
              <CardHeader>
                <CardTitle>API Usage</CardTitle>
                <CardDescription>How to use your API key</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium">Request Header</h4>
                  <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                    <code>Authorization: Bearer YOUR_API_KEY</code>
                  </pre>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 text-sm font-medium">Example Request</h4>
                  <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                    <code>{`curl -X POST https://api.waygate.dev/v1/gateway/invoke \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"integrationSlug": "slack", "actionSlug": "send-message", "input": {...}}'`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive alerts and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Email Notifications</label>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for integration errors and important updates
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleToggleNotifications}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <p className="text-sm text-muted-foreground">
                    Receive real-time alerts via webhook
                  </p>
                </div>
                <Input
                  type="url"
                  placeholder="https://your-app.com/webhooks/waygate"
                  defaultValue={initialSettings?.webhookUrl}
                />
                <Button variant="outline" size="sm">
                  Test Webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of your dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Theme</label>
                  <p className="text-sm text-muted-foreground">
                    Theme preferences are managed via the toggle in the sidebar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
