'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Globe, Sparkles, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useWizardStore } from '@/stores/wizard.store';
import { useScrapeJob } from '@/hooks/useScrapeJob';

const urlInputSchema = z.object({
  documentationUrl: z
    .string()
    .min(1, 'Documentation URL is required')
    .url('Please enter a valid URL'),
  wishlistInput: z.string().optional(),
});

type UrlInputFormData = z.infer<typeof urlInputSchema>;

export function StepUrlInput() {
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const { setDocumentationUrl, setWishlist, setScrapeJob, goToStep } = useWizardStore();
  const { startScraping, isPending } = useScrapeJob();

  const form = useForm<UrlInputFormData>({
    resolver: zodResolver(urlInputSchema),
    defaultValues: {
      documentationUrl: '',
      wishlistInput: '',
    },
  });

  const addWishlistItem = () => {
    const input = form.getValues('wishlistInput')?.trim();
    if (input && !wishlistItems.includes(input)) {
      setWishlistItems([...wishlistItems, input]);
      form.setValue('wishlistInput', '');
    }
  };

  const removeWishlistItem = (item: string) => {
    setWishlistItems(wishlistItems.filter((i) => i !== item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWishlistItem();
    }
  };

  const onSubmit = async (data: UrlInputFormData) => {
    // Store form data in wizard state
    setDocumentationUrl(data.documentationUrl);
    setWishlist(wishlistItems);

    try {
      // Start the scraping job
      const result = await startScraping({
        documentationUrl: data.documentationUrl,
        wishlist: wishlistItems,
      });

      // Store job ID and move to scraping step
      setScrapeJob(result.jobId, result.status);
      goToStep('scraping');
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Failed to start scraping:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Documentation URL */}
        <FormField
          control={form.control}
          name="documentationUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                API Documentation URL
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="https://api.example.com/docs"
                  className="font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Enter the URL of the API documentation, OpenAPI spec, or developer docs page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Wishlist (optional) */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="wishlistInput"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Action Wishlist
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Optional
                  </Badge>
                </FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder="e.g., Send message, List users, Create project"
                      onKeyDown={handleKeyDown}
                      {...field}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addWishlistItem}
                    disabled={!field.value?.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FormDescription>
                  Tell us what actions you want and AI will prioritize finding them.
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Wishlist items */}
          {wishlistItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wishlistItems.map((item) => (
                <Badge key={item} variant="secondary" className="gap-1 py-1.5 pl-3 pr-1.5">
                  {item}
                  <button
                    type="button"
                    onClick={() => removeWishlistItem(item)}
                    className="ml-1 rounded-sm hover:bg-secondary-foreground/20"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {item}</span>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Example URLs */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Example URLs:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'https://api.slack.com/methods',
              'https://stripe.com/docs/api',
              'https://developers.notion.com/reference',
            ].map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => form.setValue('documentationUrl', url)}
                className="rounded-md bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {url}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending} size="lg">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Scraping
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
