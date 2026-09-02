import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address').min(1, 'Email is required');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name is too long');

export const urlSchema = z.string().url('Invalid URL');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
});

export const pipelineSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required').max(200, 'Name too long'),
  description: z.string().max(1000).optional(),
  steps: z.array(z.object({
    type: z.enum(['dataset', 'clean', 'feature_engineer', 'train', 'evaluate', 'deploy', 'notify', 'custom']),
    name: z.string().min(1),
    config: z.record(z.any()),
  })).min(1, 'At least one step is required'),
});

export const deploymentSchema = z.object({
  model_name: z.string().min(1, 'Model is required'),
  endpoint_name: z.string().min(1, 'Endpoint name is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
});

export const webhookSchema = z.object({
  name: z.string().min(1, 'Webhook name is required'),
  url: urlSchema,
  events: z.array(z.string()).min(1, 'At least one event is required'),
});

export const datasetNameSchema = z.string().min(1, 'Dataset name is required');

export const trainingSchema = z.object({
  file_name: datasetNameSchema,
  target_column: z.string().min(1, 'Target column is required'),
});

export const apiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100),
});

export const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: passwordSchema,
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const profileSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
});

export const marketplaceSearchSchema = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
});
