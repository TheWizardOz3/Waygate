'use client';

import Link from 'next/link';
import { PlusCircle, BookOpen, Settings, Key, Zap, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    title: 'Create Integration',
    description: 'Connect a new API',
    href: '/integrations/new',
    icon: <PlusCircle className="h-5 w-5" />,
    color: 'bg-primary/10 text-primary hover:bg-primary/20',
  },
  {
    title: 'View Documentation',
    description: 'API reference & guides',
    href: '/docs',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
  },
  {
    title: 'API Keys',
    description: 'Manage access keys',
    href: '/settings',
    icon: <Key className="h-5 w-5" />,
    color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
  },
  {
    title: 'Settings',
    description: 'Configure preferences',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    color: 'bg-slate-500/10 text-slate-600 hover:bg-slate-500/20',
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map((action) => (
            <QuickActionItem key={action.href + action.title} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionItem({ action }: { action: QuickAction }) {
  return (
    <Link
      href={action.href}
      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className={cn('rounded-lg p-2 transition-colors', action.color)}>{action.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{action.title}</p>
        <p className="text-sm text-muted-foreground">{action.description}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
