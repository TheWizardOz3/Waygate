'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import { DeleteIntegrationDialog } from './DeleteIntegrationDialog';
import type { IntegrationResponse } from '@/lib/modules/integrations/integration.schemas';
import { toast } from 'sonner';

interface IntegrationHeaderProps {
  integration: IntegrationResponse;
}

export function IntegrationHeader({ integration }: IntegrationHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const handleCopySlug = async () => {
    await navigator.clipboard.writeText(integration.slug);
    setCopiedSlug(true);
    toast.success('Slug copied to clipboard');
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleRescrape = () => {
    // TODO: Implement re-scrape functionality
    toast.info('Re-scrape functionality coming soon');
  };

  return (
    <>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/integrations"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Integrations
          </Link>
          <span>/</span>
          <span className="text-foreground">{integration.name}</span>
        </div>

        {/* Main header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            {/* Title row */}
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-bold">{integration.name}</h1>
              <IntegrationStatusBadge status={integration.status} />
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {/* Slug */}
              <button
                onClick={handleCopySlug}
                className="flex items-center gap-1.5 font-mono transition-colors hover:text-foreground"
              >
                {copiedSlug ? (
                  <Check className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {integration.slug}
              </button>

              {/* Documentation URL */}
              {integration.documentationUrl && (
                <a
                  href={integration.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Documentation
                </a>
              )}

              {/* Auth type */}
              <Badge variant="outline" className="text-xs">
                {integration.authType === 'oauth2'
                  ? 'OAuth 2.0'
                  : integration.authType === 'api_key'
                    ? 'API Key'
                    : integration.authType}
              </Badge>
            </div>

            {/* Description */}
            {integration.description && (
              <p className="max-w-2xl text-muted-foreground">{integration.description}</p>
            )}

            {/* Tags */}
            {integration.tags && integration.tags.length > 0 && (
              <div className="flex items-center gap-2">
                {integration.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/integrations/${integration.id}/actions`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Actions
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRescrape}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-scrape Documentation
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/integrations/${integration.id}/settings`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Integration
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Integration
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteIntegrationDialog
        integration={integration}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}
