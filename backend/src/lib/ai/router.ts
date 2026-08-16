import { Feature, FEATURE_PROVIDER_MAP } from '../../../../shared/constants/quota';
import { Plan } from '../../../../shared/types';

export type TaskType = 'vision' | 'batch_text' | 'streaming' | 'embedding' | 'rerank' | 'low_priority'

export type AIRequest = {
  task: TaskType
  feature: Feature
  payload: {
    imageBase64?: string
    imageBase64Array?: string[]
    prompt?: string
    texts?: string[]
    documents?: string[]
    query?: string
    systemPrompt?: string
    stream?: boolean
    studentContext?: any
    questionCount?: number
    difficulty?: string
    subject?: string
    level?: string
    weakTopics?: string[]
    dueCards?: number
    upcomingExams?: string
    degree?: string
    recentPerformance?: string
    messages?: any[]
  }
  userSettings?: any
  model_tier?: string
  userId: string
  priority: 'high' | 'medium' | 'low'
  identifiers?: string[]
}

export type AIResponse = {
  result: any
  provider: string

  requestsConsumed: number
  tokensUsed?: number
  responseMs: number
}

// Router delegates to specific provider implementations
export async function routeRequest(request: AIRequest): Promise<AIResponse> {
  const start = Date.now()
  

  let provider = FEATURE_PROVIDER_MAP[request.feature] || 'gemini';
  
  // Override provider based on selected model tier
  if (request.model_tier === 'fast') {
    provider = provider.includes('groq') ? 'groq_8b' : 'gemini';
  } else if (request.model_tier === 'smart') {
    provider = provider.includes('groq') ? 'groq_70b' : 'gemini'; // ideally we'd have gemini_pro
  }

  let result = null;

  try {
    const { getProviderStatus } = await import('./balance');
    const status = await getProviderStatus(provider as any);
    
    // If the provider has fallback activated, route to groq_70b (Llama 3 70B)
    if (status && status.is_fallback_active) {
      console.warn(`[AI Router] Provider ${provider} is critically low. Falling back to groq_70b.`);
      provider = 'groq_70b';
    }
  } catch (err) {
    console.error(`[AI Router] Error checking fallback status for ${provider}:`, err);
  }

  try {
    switch (provider) {
      case 'gemini': {
        const { handleGeminiRequest } = await import('./providers/gemini');
        result = await handleGeminiRequest(request);
        break;
      }
      case 'groq_70b':
      case 'groq_8b': {
        const { handleGroqRequest } = await import('./providers/groq');
        result = await handleGroqRequest(request);
        break;
      }
      case 'huggingface': {
        const { handleHFRequest } = await import('./providers/huggingface');
        result = await handleHFRequest(request);
        break;
      }
      case 'mistral': {
        const { handleMistralRequest } = await import('./providers/mistral');
        result = await handleMistralRequest(request);
        break;
      }
      case 'cohere': {
        const { handleCohereRequest } = await import('./providers/cohere');
        result = await handleCohereRequest(request);
        break;
      }
      case 'openrouter':
      default: {
        const { handleOpenRouterRequest } = await import('./providers/openrouter');
        result = await handleOpenRouterRequest(request);
        break;
      }
    }
  } catch (error) {
    console.error(`[AI Router] Provider ${provider} failed:`, error)
    
    // Try Groq first since it has feature-specific prompt handling
    if (provider !== 'groq_70b' && provider !== 'groq_8b' && process.env.GROQ_API_KEY) {
      try {
        console.log(`[AI Router] Attempting Groq fallback for ${request.feature}`)
        provider = 'groq_70b'
        const { handleGroqRequest } = await import('./providers/groq');
        result = await handleGroqRequest(request);
      } catch (groqErr) {
        console.error('[AI Router] Groq fallback also failed, trying OpenRouter:', groqErr)
        provider = 'openrouter'
        const { handleOpenRouterRequest } = await import('./providers/openrouter');
        result = await handleOpenRouterRequest(request);
      }
    } else {
      provider = 'openrouter'
      const { handleOpenRouterRequest } = await import('./providers/openrouter');
      result = await handleOpenRouterRequest(request);
    }
  }

  return {
    result,
    provider,

    requestsConsumed: 1, // Let consumeUserQuota apply the correct feature multiplier later
    responseMs: Date.now() - start
  }
}
