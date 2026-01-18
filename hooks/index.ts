/**
 * Custom React Hooks
 */

export {
  useWebSocket,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
  type WebSocketEvent,
  type ProgressEvent,
  type JobCompleteEvent,
  type JobFailedEvent,
  type ConnectionStatus,
  type JobType,
} from './useWebSocket.js';

export { useCharacters } from './useCharacters.js';

export {
  useAudioGeneration,
  type UseAudioGenerationOptions,
  type UseAudioGenerationReturn,
  type SentenceAudioState,
  type SentenceAudioStatus,
  type BulkGenerationResult,
  type CancelResult,
} from './useAudioGeneration.js';
