import { Plugin, Notice } from "obsidian";
import { Timer } from "src/Timer";
import { Controls } from "src/Controls";
import { AudioHandler } from "src/AudioHandler";
import { MoneyPennySettingsTab } from "src/MoneyPennySettingsTab";
import { SettingsManager, MoneyPennySettings } from "src/SettingsManager";
import { NativeAudioRecorder } from "src/AudioRecorder";
import { RecordingStatus, StatusBar } from "src/StatusBar";
import { MeetingMetadata, MeetingMetadataModal } from "src/MeetingMetadataModal";
import { PasteTranscriptionModal } from "src/PasteTranscriptionModal";
import { MeetingStartModal } from "src/MeetingStartModal";
export default class MoneyPenny extends Plugin {
	settings: MoneyPennySettings;
	settingsManager: SettingsManager;
	timer: Timer;
	recorder: NativeAudioRecorder;
	audioHandler: AudioHandler;
	controls: Controls | null = null;
	statusBar: StatusBar;
	currentMeetingMetadata: MeetingMetadata | null = null;
	ribbonIconEl: HTMLElement | null = null;
	currentNoteFile: string | null = null;

	async onload() {
		this.settingsManager = new SettingsManager(this);
		this.settings = await this.settingsManager.loadSettings();

		this.ribbonIconEl = this.addRibbonIcon("mic", "MoneyPenny: Start meeting", async (evt) => {
			// If recording, stop it. Otherwise, open meeting start modal
			if (this.statusBar.status === RecordingStatus.Recording) {
				await this.stopRecordingAndProcess();
			} else {
				new MeetingStartModal(this.app, this).open();
			}
		});

		this.addSettingTab(new MoneyPennySettingsTab(this.app, this));

		this.timer = new Timer();
		this.audioHandler = new AudioHandler(this);
		this.recorder = new NativeAudioRecorder();

		this.statusBar = new StatusBar(this);

		this.addCommands();
	}

	onunload() {
		if (this.controls) {
			this.controls.close();
		}

		this.statusBar.remove();
	}

	updateRibbonIcon(isRecording: boolean) {
		if (this.ribbonIconEl) {
			const iconSvg = this.ribbonIconEl.querySelector(".svg-icon");
			if (iconSvg) {
				if (isRecording) {
					iconSvg.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><rect x="8" y="8" width="8" height="8"/>';
					this.ribbonIconEl.setAttribute("aria-label", "MoneyPenny: Stop recording");
				} else {
					iconSvg.innerHTML = '<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>';
					this.ribbonIconEl.setAttribute("aria-label", "MoneyPenny: Start recording");
				}
			}
		}
	}

	async startRecordingWithNote(metadata?: MeetingMetadata) {
		console.log("startRecordingWithNote called with metadata:", metadata);
		
		// Create note file immediately with formatted name
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = now.getHours();
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		
		const baseFileName = `${year}-${month}-${day} ${displayHours}.${minutes} ${ampm} - Meeting Notes`;
		const noteFilePath = `${baseFileName}.md`;

		// Create initial content
		let initialContent = "";
		if (this.settings.useMeetingTemplate) {
			const templateName = metadata?.meetingType || this.settings.selectedTemplate;
			const selectedTemplate = this.settings.meetingTemplates.find(
				t => t.name === templateName
			);
			
			if (selectedTemplate) {
				// Apply template with placeholder for transcription
				initialContent = selectedTemplate.template;
				const now = new Date();
				const date = now.toLocaleDateString();
				const time = now.toLocaleTimeString();
				
				initialContent = initialContent.replace(/\{\{date\}\}/g, date);
				initialContent = initialContent.replace(/\{\{time\}\}/g, time);
				initialContent = initialContent.replace(/\{\{datetime\}\}/g, `${date} ${time}`);
				initialContent = initialContent.replace(/\{\{transcription\}\}/g, "<!-- Transcription will be added after recording -->");
				initialContent = initialContent.replace(/\{\{notes\}\}/g, "");
				initialContent = initialContent.replace(/\{\{audio\}\}/g, ""); // Remove audio placeholder
				
				if (metadata) {
					initialContent = initialContent.replace(/\{\{attendees\}\}/g, metadata.attendees || "");
					initialContent = initialContent.replace(/\{\{agenda\}\}/g, metadata.agenda || "");
				} else {
					initialContent = initialContent.replace(/\{\{attendees\}\}/g, "");
					initialContent = initialContent.replace(/\{\{agenda\}\}/g, "");
				}
			}
		} else {
			initialContent = `## Notes\n\n`;
		}

		try {
			// Create and open the note
			await this.app.vault.create(noteFilePath, initialContent);
			await this.app.workspace.openLinkText(noteFilePath, "", true);
			
			// Store the note path for later
			this.currentNoteFile = noteFilePath;

			// Start recording
			this.statusBar.updateStatus(RecordingStatus.Recording);
			this.updateRibbonIcon(true);
			await this.recorder.startRecording();
			this.timer.start();
			
			console.log("Recording started successfully");
		} catch (error) {
			console.error("Error in startRecordingWithNote:", error);
			new Notice(`Error starting recording: ${error.message}`);
		}
	}

	async createMeetingNoteOnly(metadata?: MeetingMetadata) {
		// Create note file with formatted name
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = now.getHours();
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		
		const baseFileName = `${year}-${month}-${day} ${displayHours}.${minutes} ${ampm} - Meeting Notes`;
		const noteFilePath = `${baseFileName}.md`;

		// Create initial content
		let initialContent = "";
		if (this.settings.useMeetingTemplate) {
			const templateName = metadata?.meetingType || this.settings.selectedTemplate;
			const selectedTemplate = this.settings.meetingTemplates.find(
				t => t.name === templateName
			);
			
			if (selectedTemplate) {
				// Apply template without transcription
				initialContent = selectedTemplate.template;
				const now = new Date();
				const date = now.toLocaleDateString();
				const time = now.toLocaleTimeString();
				
				initialContent = initialContent.replace(/\{\{date\}\}/g, date);
				initialContent = initialContent.replace(/\{\{time\}\}/g, time);
				initialContent = initialContent.replace(/\{\{datetime\}\}/g, `${date} ${time}`);
				initialContent = initialContent.replace(/\{\{transcription\}\}/g, "");
				initialContent = initialContent.replace(/\{\{notes\}\}/g, "");
				initialContent = initialContent.replace(/\{\{audio\}\}/g, "");
				
				if (metadata) {
					initialContent = initialContent.replace(/\{\{attendees\}\}/g, metadata.attendees || "");
					initialContent = initialContent.replace(/\{\{agenda\}\}/g, metadata.agenda || "");
				} else {
					initialContent = initialContent.replace(/\{\{attendees\}\}/g, "");
					initialContent = initialContent.replace(/\{\{agenda\}\}/g, "");
				}
			}
		} else {
			initialContent = `# Meeting Notes\n\n## Date: ${new Date().toLocaleDateString()}\n\n## Notes\n\n`;
		}

		try {
			// Create and open the note
			await this.app.vault.create(noteFilePath, initialContent);
			await this.app.workspace.openLinkText(noteFilePath, "", true);
			new Notice("Meeting note created");
		} catch (err) {
			console.error("Error creating meeting note:", err);
			new Notice("Error creating meeting note: " + err.message);
		}
	}

	async stopRecordingAndProcess() {
		this.statusBar.updateStatus(RecordingStatus.Processing);
		this.updateRibbonIcon(false);
		
		const audioBlob = await this.recorder.stopRecording();
		const extension = this.recorder.getMimeType()?.split("/")[1];
		const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
		
		// Pass the current note file to the audio handler
		await this.audioHandler.sendAudioData(
			audioBlob, 
			fileName, 
			this.currentMeetingMetadata || undefined,
			this.currentNoteFile || undefined
		);
		
		// Reset state
		this.currentMeetingMetadata = null;
		this.currentNoteFile = null;
		this.statusBar.updateStatus(RecordingStatus.Idle);
	}

	addCommands() {
		this.addCommand({
			id: "start-meeting",
			name: "Start new meeting",
			callback: () => {
				new MeetingStartModal(this.app, this).open();
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "M",
				},
			],
		});

		this.addCommand({
			id: "start-stop-recording",
			name: "Start/stop recording (quick)",
			callback: async () => {
				if (this.statusBar.status !== RecordingStatus.Recording) {
					// Show metadata modal if enabled
					if (this.settings.promptForMetadata && this.settings.useMeetingTemplate) {
						new MeetingMetadataModal(
							this.app,
							this.settings.defaultAttendees,
							this.settings.selectedTemplate,
							this.settings.meetingTemplates,
							async (metadata) => {
								this.currentMeetingMetadata = metadata;
								this.settings.selectedTemplate = metadata.meetingType;
								await this.settingsManager.saveSettings(this.settings);
								await this.startRecordingWithNote(metadata);
							}
						).open();
					} else {
						await this.startRecordingWithNote();
					}
				} else {
					await this.stopRecordingAndProcess();
				}
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "R",
				},
			],
		});

		this.addCommand({
			id: "open-recording-controls",
			name: "Open recording controls",
			callback: () => {
				if (!this.controls) {
					this.controls = new Controls(this);
				}
				this.controls.open();
			}
		});

		this.addCommand({
			id: "upload-audio-file",
			name: "Upload audio file",
			callback: () => {
				// Create an input element for file selection
				const fileInput = document.createElement("input");
				fileInput.type = "file";
				fileInput.accept = "audio/*"; // Accept only audio files

				// Handle file selection
				fileInput.onchange = async (event) => {
					const files = (event.target as HTMLInputElement).files;
					if (files && files.length > 0) {
						const file = files[0];
						const fileName = file.name;
						const audioBlob = file.slice(0, file.size, file.type);
						// Use audioBlob to send or save the uploaded audio as needed
						await this.audioHandler.sendAudioData(
							audioBlob,
							fileName
						);
					}
				};

				// Programmatically open the file dialog
				fileInput.click();
			},
		});

		this.addCommand({
			id: "paste-transcription",
			name: "Paste transcription (quick)",
			callback: () => {
				new PasteTranscriptionModal(
					this.app,
					this,
					async (transcription, metadata) => {
						await this.audioHandler.handlePastedTranscription(transcription, metadata);
					}
				).open();
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "V",
				},
			],
		});
	}
}
