'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BasicInfoSection } from './editor/BasicInfoSection';
import { SchemaBuilder } from './editor/SchemaBuilder';
import { AdvancedSettings } from './editor/AdvancedSettings';
import { createEmptySchema } from './editor/types';
import { ActionEditorSchema, generateSlugFromName } from '@/lib/modules/actions/action.validation';
import { useCreateAction, useUpdateAction, useAction, useIntegration } from '@/hooks';
import type {
  JsonSchema,
  CreateActionInput,
  UpdateActionInput,
} from '@/lib/modules/actions/action.schemas';

interface ActionEditorProps {
  integrationId: string;
  actionId?: string; // If provided, we're editing
}

export function ActionEditor({ integrationId, actionId }: ActionEditorProps) {
  const router = useRouter();
  const isEditing = !!actionId;

  const { data: integration, isLoading: integrationLoading } = useIntegration(integrationId);
  const { data: existingAction, isLoading: actionLoading } = useAction(actionId, integrationId);

  const createAction = useCreateAction();
  const updateAction = useUpdateAction();

  const isLoading = integrationLoading || (isEditing && actionLoading);
  const isSaving = createAction.isPending || updateAction.isPending;

  const form = useForm({
    resolver: zodResolver(ActionEditorSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      httpMethod: 'GET' as const,
      endpointTemplate: '/',
      inputSchema: createEmptySchema(),
      outputSchema: createEmptySchema(),
      cacheable: false,
      cacheTtlSeconds: null as number | null,
      retryConfig: null as { maxRetries: number; retryableStatuses: number[] } | null,
    },
  });

  // Update form when existing action is loaded
  useEffect(() => {
    if (existingAction) {
      form.reset({
        name: existingAction.name,
        slug: existingAction.slug,
        description: existingAction.description ?? '',
        httpMethod: existingAction.httpMethod,
        endpointTemplate: existingAction.endpointTemplate,
        inputSchema: existingAction.inputSchema,
        outputSchema: existingAction.outputSchema,
        cacheable: existingAction.cacheable,
        cacheTtlSeconds: existingAction.cacheTtlSeconds,
        retryConfig: existingAction.retryConfig,
      });
    }
  }, [existingAction, form]);

  // Auto-generate slug from name
  const name = form.watch('name');

  useEffect(() => {
    if (!isEditing && name) {
      form.setValue('slug', generateSlugFromName(name));
    }
  }, [name, isEditing, form]);

  const handleInputSchemaChange = useCallback(
    (schema: JsonSchema) => {
      form.setValue('inputSchema', schema);
    },
    [form]
  );

  const handleOutputSchemaChange = useCallback(
    (schema: JsonSchema) => {
      form.setValue('outputSchema', schema);
    },
    [form]
  );

  const onSubmit = async (data: FieldValues) => {
    try {
      if (isEditing && actionId) {
        const updatePayload: UpdateActionInput & { id: string } = {
          id: actionId,
          name: data.name,
          description: data.description,
          httpMethod: data.httpMethod,
          endpointTemplate: data.endpointTemplate,
          inputSchema: data.inputSchema,
          outputSchema: data.outputSchema,
          cacheable: data.cacheable,
          cacheTtlSeconds: data.cacheTtlSeconds,
          retryConfig: data.retryConfig,
        };
        await updateAction.mutateAsync(updatePayload);
        toast.success('Action updated successfully');
      } else {
        const slug = data.slug || generateSlugFromName(data.name);
        const createPayload: CreateActionInput = {
          integrationId,
          name: data.name,
          slug,
          description: data.description,
          httpMethod: data.httpMethod,
          endpointTemplate: data.endpointTemplate,
          inputSchema: data.inputSchema,
          outputSchema: data.outputSchema,
          cacheable: data.cacheable,
          cacheTtlSeconds: data.cacheTtlSeconds,
          retryConfig: data.retryConfig,
        };
        await createAction.mutateAsync(createPayload);
        toast.success('Action created successfully');
      }
      router.push(`/integrations/${integrationId}/actions`);
    } catch {
      // Error is handled by mutation
    }
  };

  if (isLoading) {
    return <ActionEditorSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="transition-colors hover:text-foreground">
          Integrations
        </Link>
        <span>/</span>
        <Link
          href={`/integrations/${integrationId}`}
          className="transition-colors hover:text-foreground"
        >
          {integration?.name ?? 'Integration'}
        </Link>
        <span>/</span>
        <Link
          href={`/integrations/${integrationId}/actions`}
          className="transition-colors hover:text-foreground"
        >
          Actions
        </Link>
        <span>/</span>
        <span className="text-foreground">{isEditing ? 'Edit' : 'New'}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/integrations/${integrationId}/actions`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">
              {isEditing ? 'Edit Action' : 'Create Action'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? `Editing ${existingAction?.name}`
                : `Create a new action for ${integration?.name}`}
            </p>
          </div>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Save Changes' : 'Create Action'}
            </>
          )}
        </Button>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <BasicInfoSection
            form={form as unknown as import('react-hook-form').UseFormReturn<FieldValues>}
            isEditing={isEditing}
            integrationSlug={integration?.slug}
          />

          <SchemaBuilder
            title="Input Schema"
            description="Define the parameters this action accepts"
            schema={form.watch('inputSchema') as JsonSchema}
            onChange={handleInputSchemaChange}
          />

          <SchemaBuilder
            title="Output Schema"
            description="Define the response structure for this action"
            schema={form.watch('outputSchema') as JsonSchema}
            onChange={handleOutputSchemaChange}
          />

          <AdvancedSettings
            form={form as unknown as import('react-hook-form').UseFormReturn<FieldValues>}
          />
        </form>
      </Form>
    </div>
  );
}

function ActionEditorSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-64" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
