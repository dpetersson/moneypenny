import { App, Modal, Notice, Setting } from "obsidian";
import MoneyPenny from "main";
import { MeetingMetadataModal, MeetingMetadata } from "./MeetingMetadataModal";

export class PasteTranscriptionModal extends Modal {
	private plugin: MoneyPenny;
	private transcription: string = "";
	private onSubmit: (transcription: string, metadata?: MeetingMetadata) => void;

	constructor(
		app: App, 
		plugin: MoneyPenny,
		onSubmit: (transcription: string, metadata?: MeetingMetadata) => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Paste Transcription" });
		
		contentEl.createEl("p", { 
			text: "If your recording is too large for automatic processing, you can transcribe it elsewhere (e.g., using OpenAI Whisper web interface, Google Meet transcription, etc.) and paste the transcription here.",
			cls: "moneypenny-info"
		});

		// Create textarea for transcription
		const textAreaContainer = contentEl.createDiv({ cls: "moneypenny-textarea-container" });
		const textArea = textAreaContainer.createEl("textarea", {
			placeholder: "Paste your transcription here...\n\nYou can include timestamps in formats like [00:00] or [00:00:00] if available.",
			cls: "moneypenny-transcription-textarea"
		});
		textArea.style.width = "100%";
		textArea.style.minHeight = "300px";
		textArea.style.fontFamily = "monospace";
		textArea.style.fontSize = "14px";
		textArea.style.padding = "10px";
		textArea.style.marginBottom = "10px";

		// Add settings for processing options
		new Setting(contentEl)
			.setName("Format transcription")
			.setDesc("Apply paragraph formatting and timestamp detection")
			.addToggle(toggle => toggle
				.setValue(true)
				.onChange(value => {
					// Store preference if needed
				}));

		// Add buttons
		const buttonContainer = contentEl.createDiv({ cls: "moneypenny-button-container" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const submitButton = buttonContainer.createEl("button", { 
			text: "Create Note",
			cls: "mod-cta"
		});
		submitButton.addEventListener("click", async () => {
			this.transcription = textArea.value.trim();
			
			if (!this.transcription) {
				new Notice("Please paste a transcription");
				return;
			}

			// If metadata prompting is enabled, show metadata modal
			if (this.plugin.settings.promptForMetadata) {
				this.close();
				new MeetingMetadataModal(
					this.app,
					this.plugin.settings.defaultAttendees,
					this.plugin.settings.selectedTemplate,
					this.plugin.settings.meetingTemplates,
					(metadata: MeetingMetadata) => {
						this.onSubmit(this.formatTranscription(this.transcription), metadata);
					},
					"Create Note"
				).open();
			} else {
				this.close();
				this.onSubmit(this.formatTranscription(this.transcription));
			}
		});

		// Focus on the textarea
		textArea.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private formatTranscription(text: string): string {
		// Basic formatting: ensure proper paragraph breaks
		let formatted = text;
		
		// Detect and format timestamps if present
		// Common formats: [00:00], [00:00:00], (00:00), 00:00 -, etc.
		const timestampPatterns = [
			/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,  // [00:00] or [00:00:00]
			/\((\d{1,2}:\d{2}(?::\d{2})?)\)/g,  // (00:00) or (00:00:00)
			/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]/gm, // 00:00 - at line start
		];

		// Make timestamps bold
		timestampPatterns.forEach(pattern => {
			formatted = formatted.replace(pattern, '**[$1]**');
		});

		// Ensure proper paragraph spacing
		// Replace single line breaks with double line breaks if not already present
		formatted = formatted.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');

		// Trim excess whitespace
		formatted = formatted.trim();

		return formatted;
	}
}