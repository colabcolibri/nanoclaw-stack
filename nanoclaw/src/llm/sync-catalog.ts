import { upsertLlmModel, upsertLlmProvider } from '../db/llm-models.js';
import { log } from '../log.js';
import { LLM_MODEL_CATALOG, LLM_PROVIDER_CATALOG } from './catalog.js';

/** Sincroniza o catálogo versionado no código para o banco (idempotente). */
export function syncLlmCatalogToDatabase(): void {
  for (const provider of LLM_PROVIDER_CATALOG) {
    upsertLlmProvider({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      completionUrl: provider.completionUrl,
      keyEnvName: provider.keyEnvName,
      baseUrlEnvName: provider.baseUrlEnvName ?? undefined,
      defaultModelId: provider.defaultModelId,
      protocol: provider.protocol,
      defaultParams: provider.defaultParams,
      sortOrder: provider.sortOrder,
      isActive: true,
    });
  }

  for (const model of LLM_MODEL_CATALOG) {
    upsertLlmModel({
      id: model.id,
      providerId: model.providerId,
      displayName: model.displayName,
      description: model.description,
      recommendedRole: model.recommendedRole,
      contextWindow: model.contextWindow,
      isRecommended: model.isRecommended,
      inputPerMillion: model.inputPerMillion,
      outputPerMillion: model.outputPerMillion,
      cacheWritePerMillion: model.cacheWritePerMillion,
      cacheHitPerMillion: model.cacheHitPerMillion,
      savingsPct: model.savingsPct,
      inferenceParams: model.inferenceParams,
      sortOrder: model.sortOrder,
      isActive: true,
    });
  }

  log.info('LLM catalog synced to database', {
    providers: LLM_PROVIDER_CATALOG.length,
    models: LLM_MODEL_CATALOG.length,
  });
}
