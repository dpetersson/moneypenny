import { Notice } from "obsidian";

export interface AudioRecorder {
	startRecording(): Promise<void>;
	pauseRecording(): Promise<void>;
	stopRecording(): Promise<Blob>;
}

function getSupportedMimeType(): string | undefined {
	// Prioritize formats with better compression for voice
	// webm;codecs=opus is ideal for voice - very efficient compression
	const mimeTypes = [
		"audio/webm;codecs=opus",  // Best: Opus codec in WebM container (~6-32 kbps for voice)
		"audio/ogg;codecs=opus",    // Good: Opus in Ogg container
		"audio/webm",               // Fallback: WebM with default codec
		"audio/ogg",                // Fallback: Ogg with default codec
		"audio/mp4",                // Less efficient for voice
		"audio/mp3"                 // Least efficient for voice
	];

	for (const mimeType of mimeTypes) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			return mimeType;
		}
	}

	return undefined;
}

function getRecorderOptions(mimeType: string): MediaRecorderOptions {
	const options: MediaRecorderOptions = { mimeType };
	
	// Set bitrate for better compression (especially for voice)
	// Opus is very efficient at low bitrates for speech
	if (mimeType.includes('opus')) {
		// Use lower bitrate for voice - Opus handles speech well at 16-24 kbps
		options.audioBitsPerSecond = 16000; // 16 kbps - excellent for voice, very small files
	} else {
		// For other codecs, use slightly higher bitrate
		options.audioBitsPerSecond = 32000; // 32 kbps
	}
	
	return options;
}

export class NativeAudioRecorder implements AudioRecorder {
	private chunks: BlobPart[] = [];
	private recorder: MediaRecorder | null = null;
	private mimeType: string | undefined;

	getRecordingState(): "inactive" | "recording" | "paused" | undefined {
		return this.recorder?.state;
	}

	getMimeType(): string | undefined {
		return this.mimeType;
	}

	async startRecording(): Promise<void> {
		if (!this.recorder) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				this.mimeType = getSupportedMimeType();

				if (!this.mimeType) {
					throw new Error("No supported mimeType found");
				}

				const options = getRecorderOptions(this.mimeType);
				const recorder = new MediaRecorder(stream, options);

				recorder.addEventListener("dataavailable", (e: BlobEvent) => {
					console.log("dataavailable", e.data.size);
					this.chunks.push(e.data);
				});

				this.recorder = recorder;
			} catch (err) {
				new Notice("Error initializing recorder: " + err);
				console.error("Error initializing recorder:", err);
				return;
			}
		}

		this.recorder.start(100);
	}

	async pauseRecording(): Promise<void> {
		if (!this.recorder) {
			return;
		}

		if (this.recorder.state === "recording") {
			this.recorder.pause();
		} else if (this.recorder.state === "paused") {
			this.recorder.resume();
		}
	}

	async stopRecording(): Promise<Blob> {
		return new Promise((resolve) => {
			if (!this.recorder || this.recorder.state === "inactive") {
				const blob = new Blob(this.chunks, { type: this.mimeType });
				this.chunks.length = 0;

				console.log("Stop recording (no active recorder):", blob);

				resolve(blob);
			} else {
				this.recorder.addEventListener(
					"stop",
					() => {
						const blob = new Blob(this.chunks, {
							type: this.mimeType,
						});
						this.chunks.length = 0;

						console.log("Stop recording (active recorder):", blob);

						// will stop all the tracks associated with the stream, effectively releasing any resources (like the mic) used by them
						if (this.recorder) {
							this.recorder.stream
								.getTracks()
								.forEach((track) => track.stop());
							this.recorder = null;
						}

						resolve(blob);
					},
					{ once: true }
				);

				this.recorder.stop();
			}
		});
	}
}
