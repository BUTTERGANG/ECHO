/** Shared contract for the platform-split `useRecording` hook. */

export interface RecordingResult {
  /** The captured audio. Web: webm/opus or mp4 Blob; native: file-backed. */
  blob: Blob;
  /** Recording length in milliseconds. */
  durationMs: number;
  /** Container/codec MIME type the recorder produced. */
  mimeType: string;
}
