export type ProviderName = 'gemini' | 'groq_70b' | 'groq_8b' | 'huggingface' | 'mistral' | 'cohere' | 'openrouter' | 'cloudflare' | 'youtube'

export type Feature = 
  | 'slide_explanation' | 'flashcard_generation' | 'quiz_generation' | 'past_paper_grading'
  | 'past_paper_question' | 'lecture_tagging' | 'difficulty_rating' | 'topic_summary'
  | 'trend_analysis' | 'weakness_drill' | 'gap_filler' | 'semester_narrative'
  | 'handwriting_scan' | 'answer_improver'
  | 'calculator' | 'chat_message' | 'debate_mode' | 'oral_exam'
  | 'daily_brief' | 'motivational_quote' | 'break_suggestion'
  | 'slide_embedding' | 'search_embedding' | 'flashcard_embedding'
  | 'semantic_search_rerank' | 'youtube_search'
  | 'revision_song' | 'study_poster' | 'cheat_sheet' | 'generate_mnemonics'

export type PoolType = 'credit_funded' | 'free_daily' | 'free_rate_limit'

export interface ProviderConfig {
  pool_type: PoolType
  has_user_quota: boolean
  user_quota_column?: string // base name, without _daily_used etc
}

export const PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
  gemini:      { pool_type: 'credit_funded',    has_user_quota: true,  user_quota_column: 'gemini' },
  groq_70b:    { pool_type: 'credit_funded',    has_user_quota: true,  user_quota_column: 'groq70' },
  groq_8b:     { pool_type: 'credit_funded',    has_user_quota: true,  user_quota_column: 'groq8' },
  huggingface: { pool_type: 'free_rate_limit',  has_user_quota: false },
  mistral:     { pool_type: 'credit_funded',    has_user_quota: false }, // fallback
  cohere:      { pool_type: 'credit_funded',    has_user_quota: true,  user_quota_column: 'cohere' },
  openrouter:  { pool_type: 'free_rate_limit',  has_user_quota: false }, // fallback
  cloudflare:  { pool_type: 'free_daily',       has_user_quota: false }, // fallback
  youtube:     { pool_type: 'credit_funded',    has_user_quota: true,  user_quota_column: 'youtube' }
}

export const FEATURE_PROVIDER_MAP: Record<Feature, ProviderName> = {
  slide_explanation: 'gemini',
  flashcard_generation: 'gemini',
  quiz_generation: 'gemini',
  past_paper_grading: 'gemini',
  past_paper_question: 'gemini',
  lecture_tagging: 'gemini',
  difficulty_rating: 'gemini',
  topic_summary: 'gemini',
  trend_analysis: 'gemini',
  weakness_drill: 'gemini',
  gap_filler: 'gemini',
  semester_narrative: 'gemini',
  handwriting_scan: 'gemini',
  answer_improver: 'gemini',
  calculator: 'groq_70b',
  chat_message: 'groq_70b',
  debate_mode: 'groq_70b',
  oral_exam: 'groq_70b',
  daily_brief: 'groq_8b',
  motivational_quote: 'groq_8b',
  break_suggestion: 'groq_8b',
  slide_embedding: 'huggingface',
  search_embedding: 'huggingface',
  flashcard_embedding: 'huggingface',
  semantic_search_rerank: 'cohere',
  youtube_search: 'youtube',
  revision_song: 'groq_70b',
  study_poster: 'gemini',
  cheat_sheet: 'gemini',
  generate_mnemonics: 'gemini'
}

export const FEATURE_COSTS: Record<Feature, number> = {
  slide_explanation: 200,
  flashcard_generation: 200,
  quiz_generation: 200,
  past_paper_grading: 200,
  past_paper_question: 200,
  lecture_tagging: 200,
  difficulty_rating: 200,
  topic_summary: 200,
  trend_analysis: 200,
  weakness_drill: 200,
  gap_filler: 200,
  semester_narrative: 200,
  handwriting_scan: 200,
  answer_improver: 200,
  study_poster: 200,
  cheat_sheet: 200,
  generate_mnemonics: 200,

  calculator: 100,
  chat_message: 100,
  debate_mode: 100,
  oral_exam: 100,
  revision_song: 100,

  daily_brief: 100,
  motivational_quote: 100,
  break_suggestion: 100,

  slide_embedding: 0,
  search_embedding: 0,
  flashcard_embedding: 0,
  
  semantic_search_rerank: 100,
  youtube_search: 100
}

export const MODEL_MULTIPLIERS: Record<string, number> = {
  'fast': 0.5,     // e.g. Gemini Flash, Groq 8B
  'smart': 2.0,    // e.g. Gemini Pro, Groq 70B
  'default': 1.0
}

// Every user gets these daily allowances for free, resets at midnight.
export const FREE_DAILY_ALLOWANCES: Record<string, number> = {
  gemini: 5000,
  groq70: 1000,
  groq8: 2000,
  cohere: 0, // Cohere has no free daily allowance, strictly uses credits or fallback if needed
  youtube: 300
}
