import { App, Modal, ButtonComponent, Setting } from "obsidian";
import MoneyPenny from "main";
import { MeetingMetadataModal, MeetingMetadata } from "./MeetingMetadataModal";
import { PasteTranscriptionModal } from "./PasteTranscriptionModal";

export class MeetingStartModal extends Modal {
	private plugin: MoneyPenny;

	constructor(app: App, plugin: MoneyPenny) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Start Meeting Notes" });
		
		contentEl.createEl("p", { 
			text: "How would you like to capture this meeting?",
			cls: "moneypenny-subtitle"
		});

		// Create button container
		const buttonContainer = contentEl.createDiv({ cls: "moneypenny-meeting-start-buttons" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.flexDirection = "column";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		// Record Audio button
		const recordButton = new ButtonComponent(buttonContainer.createDiv());
		recordButton
			.setButtonText("🎙️ Record Audio")
			.setCta()
			.onClick(() => {
				this.close();
				// Show metadata modal if enabled
				if (this.plugin.settings.promptForMetadata && this.plugin.settings.useMeetingTemplate) {
					new MeetingMetadataModal(
						this.app,
						this.plugin.settings.defaultAttendees,
						this.plugin.settings.selectedTemplate,
						this.plugin.settings.meetingTemplates,
						async (metadata) => {
							this.plugin.currentMeetingMetadata = metadata;
							this.plugin.settings.selectedTemplate = metadata.meetingType;
							await this.plugin.settingsManager.saveSettings(this.plugin.settings);
							await this.plugin.startRecordingWithNote(metadata);
						}
					).open();
				} else {
					this.plugin.startRecordingWithNote();
				}
			});
		recordButton.buttonEl.style.width = "100%";
		recordButton.buttonEl.style.padding = "10px";

		// Add description for record button
		const recordDesc = buttonContainer.createEl("div", {
			text: "Start recording audio and transcribe with OpenAI Whisper",
			cls: "setting-item-description"
		});
		recordDesc.style.marginBottom = "15px";
		recordDesc.style.fontSize = "0.9em";

		// Paste Transcription button
		const pasteButton = new ButtonComponent(buttonContainer.createDiv());
		pasteButton
			.setButtonText("📋 Paste Transcription")
			.onClick(() => {
				this.close();
				new PasteTranscriptionModal(
					this.app,
					this.plugin,
					async (transcription, metadata) => {
						await this.plugin.audioHandler.handlePastedTranscription(transcription, metadata);
					}
				).open();
			});
		pasteButton.buttonEl.style.width = "100%";
		pasteButton.buttonEl.style.padding = "10px";

		// Add description for paste button
		const pasteDesc = buttonContainer.createEl("div", {
			text: "Paste a transcription from Google Meet, Zoom, or other sources",
			cls: "setting-item-description"
		});
		pasteDesc.style.fontSize = "0.9em";
		pasteDesc.style.marginBottom = "15px";

		// Create Note Only button (for manual note-taking)
		const noteButton = new ButtonComponent(buttonContainer.createDiv());
		noteButton
			.setButtonText("📝 Create Note Only")
			.onClick(() => {
				this.close();
				// Show metadata modal if enabled
				if (this.plugin.settings.promptForMetadata && this.plugin.settings.useMeetingTemplate) {
					new MeetingMetadataModal(
						this.app,
						this.plugin.settings.defaultAttendees,
						this.plugin.settings.selectedTemplate,
						this.plugin.settings.meetingTemplates,
						async (metadata) => {
							await this.plugin.createMeetingNoteOnly(metadata);
						},
						"Create Note"
					).open();
				} else {
					this.plugin.createMeetingNoteOnly();
				}
			});
		noteButton.buttonEl.style.width = "100%";
		noteButton.buttonEl.style.padding = "10px";

		// Add description for note button
		const noteDesc = buttonContainer.createEl("div", {
			text: "Create a meeting note without recording or transcription",
			cls: "setting-item-description"
		});
		noteDesc.style.fontSize = "0.9em";

		// Add cancel button
		const cancelContainer = contentEl.createDiv();
		cancelContainer.style.marginTop = "20px";
		cancelContainer.style.textAlign = "center";
		
		const cancelButton = new ButtonComponent(cancelContainer);
		cancelButton
			.setButtonText("Cancel")
			.onClick(() => {
				this.close();
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}