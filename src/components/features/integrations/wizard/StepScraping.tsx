'use client';

import { useEffect } from 'react';
import { Check, Loader2, AlertCircle, Globe, FileSearch, Cpu, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/stores/wizard.store';
import { useScrapeJobStatus } from '@/hooks/useScrapeJob';
import { cn } from '@/lib/utils';

interface StepItemProps {
  icon: React.ReactNode;
  label: string;
  status: 'pending' | 'active' | 'completed';
  detail?: string;
}

function StepItem({ icon, label, status, detail }: StepItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        status === 'pending' && 'border-border/50 bg-muted/30 text-muted-foreground',
        status === 'active' && 'border-secondary/50 bg-secondary/10',
        status === 'completed' && 'border-accent/50 bg-accent/10'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          status === 'pending' && 'bg-muted text-muted-foreground',
          status === 'active' && 'bg-secondary/20 text-secondary',
          status === 'completed' && 'bg-accent/20 text-accent'
        )}
      >
        {status === 'active' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === 'completed' ? (
          <Check className="h-4 w-4" />
        ) : (
          icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium',
            status === 'active' && 'text-foreground',
            status === 'completed' && 'text-foreground'
          )}
        >
          {label}
        </p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

export function StepScraping() {
  const {
    data,
    updateScrapeProgress,
    setDetectedActions,
    setDetectedAuthMethods,
    setDetectedApiInfo,
    goToStep,
    goBack,
  } = useWizardStore();

  const { data: jobData, isError, error } = useScrapeJobStatus(data.scrapeJobId);

  // Update wizard state when job status changes
  useEffect(() => {
    if (!jobData) return;

    updateScrapeProgress(jobData.progress, jobData.currentStep || '', jobData.status);

    // Handle completion
    if (jobData.status === 'COMPLETED' && 'result' in jobData) {
      const result = jobData.result;

      // Store detected data
      setDetectedApiInfo(result.name, result.baseUrl);
      setDetectedAuthMethods(result.authMethods);
      setDetectedActions(result.endpoints);

      // Move to review step
      goToStep('review-actions');
    }
  }, [
    jobData,
    updateScrapeProgress,
    setDetectedApiInfo,
    setDetectedAuthMethods,
    setDetectedActions,
    goToStep,
  ]);

  // Derive step statuses from current status
  const getStepStatus = (
    step: 'crawling' | 'parsing' | 'generating'
  ): 'pending' | 'active' | 'completed' => {
    const statusOrder = ['PENDING', 'CRAWLING', 'PARSING', 'GENERATING', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(data.scrapeStatus || 'PENDING');
    const stepIndices = {
      crawling: 1,
      parsing: 2,
      generating: 3,
    };
    const stepIndex = stepIndices[step];

    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  // Handle failed state
  if (isError || data.scrapeStatus === 'FAILED') {
    const errorMessage =
      error?.message ||
      (jobData && 'error' in jobData ? jobData.error.message : 'An unknown error occurred');

    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Scraping Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => goBack()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-mono text-foreground">{data.scrapeProgress}%</span>
        </div>
        <Progress value={data.scrapeProgress} className="h-2" />
        <p className="text-sm text-muted-foreground">{data.scrapeCurrentStep || 'Starting...'}</p>
      </div>

      {/* Step indicators */}
      <div className="space-y-3">
        <StepItem
          icon={<Globe className="h-4 w-4" />}
          label="Crawling Documentation"
          status={getStepStatus('crawling')}
          detail={
            getStepStatus('crawling') === 'active'
              ? `Scanning ${data.documentationUrl}`
              : getStepStatus('crawling') === 'completed'
                ? 'Pages discovered'
                : undefined
          }
        />
        <StepItem
          icon={<FileSearch className="h-4 w-4" />}
          label="Parsing API Specification"
          status={getStepStatus('parsing')}
          detail={
            getStepStatus('parsing') === 'active' ? 'Extracting endpoints and schemas' : undefined
          }
        />
        <StepItem
          icon={<Sparkles className="h-4 w-4" />}
          label="Generating Actions"
          status={getStepStatus('generating')}
          detail={
            getStepStatus('generating') === 'active'
              ? 'AI is creating action definitions'
              : undefined
          }
        />
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 h-5 w-5 text-secondary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">AI-Powered Analysis</p>
            <p className="mt-1 text-muted-foreground">
              Our AI is reading the documentation, identifying authentication methods, and
              extracting API endpoints. This typically takes 30-60 seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
