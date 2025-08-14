import { Notice } from "obsidian";

export interface AudioChunk {
	blob: Blob;
	index: number;
	startTime: number;
	endTime: number;
}

export class AudioChunker {
	private static readonly MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB to stay under 25MB limit
	private static readonly CHUNK_DURATION = 300; // 5 minutes in seconds
	private static readonly OVERLAP_DURATION = 5; // 5 seconds overlap between chunks

	/**
	 * Checks if audio needs chunking based on file size
	 */
	static needsChunking(blob: Blob): boolean {
		return blob.size > this.MAX_CHUNK_SIZE;
	}

	/**
	 * Splits audio blob into smaller chunks for processing
	 * Note: This is a simplified approach that splits by size.
	 * For better results, we'd need to decode and re-encode audio at chunk boundaries
	 */
	static async chunkAudioBySize(blob: Blob): Promise<AudioChunk[]> {
		const chunks: AudioChunk[] = [];
		const chunkSize = this.MAX_CHUNK_SIZE;
		const totalChunks = Math.ceil(blob.size / chunkSize);
		
		// Estimate duration based on file size (rough approximation)
		// WebM/Opus typically uses ~16-32 kbps for voice
		const estimatedBitrate = 24000; // 24 kbps average
		const estimatedDuration = (blob.size * 8) / estimatedBitrate; // in seconds
		const chunkDuration = estimatedDuration / totalChunks;

		for (let i = 0; i < totalChunks; i++) {
			const start = i * chunkSize;
			const end = Math.min(start + chunkSize, blob.size);
			const chunkBlob = blob.slice(start, end, blob.type);
			
			chunks.push({
				blob: chunkBlob,
				index: i,
				startTime: i * chunkDuration,
				endTime: (i + 1) * chunkDuration
			});
		}

		new Notice(`Audio split into ${chunks.length} chunks for processing`);
		return chunks;
	}

	/**
	 * Estimates recording duration from blob size
	 */
	static estimateDuration(blob: Blob): number {
		// WebM/Opus typically uses ~16-32 kbps for voice
		const estimatedBitrate = 24000; // 24 kbps average
		return (blob.size * 8) / estimatedBitrate; // in seconds
	}

	/**
	 * Formats duration in human-readable format
	 */
	static formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m ${secs}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	}

	/**
	 * Gets file size in MB
	 */
	static getSizeInMB(blob: Blob): number {
		return blob.size / (1024 * 1024);
	}

	/**
	 * Checks if we're approaching the size limit
	 */
	static isApproachingLimit(blob: Blob): boolean {
		return this.getSizeInMB(blob) > 20; // Warning at 20MB
	}
}