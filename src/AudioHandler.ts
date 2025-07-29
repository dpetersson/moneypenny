import axios from "axios";
import MoneyPenny from "main";
import { Notice, MarkdownView, TFile } from "obsidian";
import { getBaseFileName } from "./utils";
import { MeetingMetadata } from "./MeetingMetadataModal";
import { AIAnalysisService } from "./AIAnalysisService";

export class AudioHandler {
	private plugin: MoneyPenny;
	private aiService: AIAnalysisService;

	constructor(plugin: MoneyPenny) {
		this.plugin = plugin;
		this.aiService = new AIAnalysisService(plugin);
	}

	async sendAudioData(blob: Blob, fileName: string, metadata?: MeetingMetadata, existingNoteFile?: string): Promise<void> {
		// Get the base file name without extension
		const baseFileName = getBaseFileName(fileName);

		// We don't save audio files anymore
		const audioFilePath = fileName;

		const noteFilePath = `${baseFileName}.md`;

		if (this.plugin.settings.debugMode) {
			new Notice(`Sending audio data size: ${blob.size / 1000} KB`);
		}

		if (!this.plugin.settings.apiKey) {
			new Notice(
				"API key is missing. Please add your API key in the settings."
			);
			return;
		}

		const formData = new FormData();
		formData.append("file", blob, fileName);
		formData.append("model", this.plugin.settings.model);
		formData.append("language", this.plugin.settings.language);
		if (this.plugin.settings.prompt)
			formData.append("prompt", this.plugin.settings.prompt);
		// Always request timestamps for better processing
		formData.append("response_format", "verbose_json");
		formData.append("timestamp_granularities", "segment");

		// We no longer save audio files

		try {
			if (this.plugin.settings.debugMode) {
				new Notice("Parsing audio data:" + fileName);
			}
			const response = await axios.post(
				this.plugin.settings.apiUrl,
				formData,
				{
					headers: {
						"Content-Type": "multipart/form-data",
						Authorization: `Bearer ${this.plugin.settings.apiKey}`,
					},
				}
			);

			// Process the response with timestamps
			const transcriptionData = response.data;
			let formattedTranscription = "";

			// Check if we have segments with timestamps
			if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
				// Format transcription with timestamps
				formattedTranscription = this.formatTranscriptionWithTimestamps(transcriptionData.segments);
			} else {
				// Fallback to plain text if no segments
				formattedTranscription = transcriptionData.text || response.data;
			}

			// Check if we have an existing note file to update
			if (existingNoteFile) {
				// Read the existing file
				const existingFile = this.plugin.app.vault.getAbstractFileByPath(existingNoteFile);
				if (existingFile && existingFile instanceof TFile) {
					const content = await this.plugin.app.vault.read(existingFile);
					
					// Replace placeholders with actual content
					let updatedContent = content;
					updatedContent = updatedContent.replace(
						"<!-- Transcription will be added after recording -->", 
						formattedTranscription
					);
					
					// Analyze the meeting if enabled
					if (this.plugin.settings.enableAIAnalysis) {
						new Notice("Analyzing meeting with AI...");
						
						// Extract existing content from the note
						const notesMatch = content.match(/### Notes\n([\s\S]*?)(?=###|$)/);
						const participantsMatch = content.match(/### Participants\n([\s\S]*?)(?=###|$)/);
						const agendaMatch = content.match(/### Agenda\n([\s\S]*?)(?=###|$)/);
						
						const existingNotes = notesMatch ? notesMatch[1].trim() : "";
						const existingParticipants = participantsMatch ? participantsMatch[1].trim() : "";
						const existingAgenda = agendaMatch ? agendaMatch[1].trim() : "";
						
						// Combine transcription with notes for analysis
						let analysisInput = transcriptionData.text || formattedTranscription;
						if (existingNotes) {
							analysisInput = `User Notes:\n${existingNotes}\n\nTranscription:\n${analysisInput}`;
						}
						
						const analysis = await this.aiService.analyzeMeeting(
							analysisInput,
							existingParticipants,
							existingAgenda
						);
						
						if (analysis) {
							// Update Participants - append new ones
							if (analysis.participants && analysis.participants.length > 0) {
								// Parse existing participants
								const existingList = existingParticipants ? existingParticipants.split(',').map(p => p.trim()).filter(p => p) : [];
								// Find new participants not in the existing list
								const newParticipants = analysis.participants.filter(p => 
									!existingList.some(existing => existing.toLowerCase() === p.toLowerCase())
								);
								// Combine existing and new
								if (newParticipants.length > 0 || existingList.length === 0) {
									const allParticipants = [...existingList, ...newParticipants];
									const participantsText = allParticipants.join(', ');
									updatedContent = updatedContent.replace(
										/### Participants\n[^#]*/,
										`### Participants\n${participantsText}\n\n`
									);
								}
							}
							
							// Update Agenda - append new items
							if (analysis.agenda && analysis.agenda.length > 0) {
								// Parse existing agenda items
								const existingItems = existingAgenda ? existingAgenda.split('\n')
									.map(line => line.replace(/^[-*]\s*/, '').trim())
									.filter(item => item && item !== '-') : [];
								// Find new agenda items not in the existing list
								const newItems = analysis.agenda.filter(item => 
									!existingItems.some(existing => existing.toLowerCase() === item.toLowerCase())
								);
								// Combine existing and new
								if (newItems.length > 0 || existingItems.length === 0) {
									const allItems = [...existingItems, ...newItems];
									const agendaText = allItems.map(item => `- ${item}`).join('\n');
									updatedContent = updatedContent.replace(
										/### Agenda\n[^#]*/,
										`### Agenda\n${agendaText}\n\n`
									);
								}
							}
							
							// Update Key Points
							if (analysis.keyPoints.length > 0) {
								const keyPointsText = analysis.keyPoints.map(point => `- ${point}`).join('\n');
								updatedContent = updatedContent.replace(/### Key Points\n- /, `### Key Points\n${keyPointsText}`);
							}
							
							// Update Action Items
							if (analysis.actionItems.length > 0) {
								const actionItemsText = analysis.actionItems.map(item => {
									// Ensure proper checkbox format
									if (!item.startsWith('[ ]') && !item.startsWith('[x]')) {
										return `- [ ] ${item}`;
									}
									return `- ${item}`;
								}).join('\n');
								updatedContent = updatedContent.replace(/### Action Items\n- \[ \] /, `### Action Items\n${actionItemsText}`);
							}
							
							// Update Next Steps
							if (analysis.nextSteps.length > 0) {
								const nextStepsText = analysis.nextSteps.map(step => `- ${step}`).join('\n');
								updatedContent = updatedContent.replace(/### Next Steps\n- /, `### Next Steps\n${nextStepsText}`);
							}
							
							new Notice("AI analysis complete!");
						}
					}
					
					// Write the updated content
					await this.plugin.app.vault.modify(existingFile, updatedContent);
				}
			} else {
				// Original logic for creating new file or inserting at cursor
				const activeView =
					this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				// Always create a new file (removed the setting)
				const shouldCreateNewFile = true;

				if (shouldCreateNewFile) {
					const content = this.plugin.settings.useMeetingTemplate 
						? this.applyTemplate(audioFilePath, formattedTranscription, metadata)
						: `![[${audioFilePath}]]\n\n${formattedTranscription}`;
					
					await this.plugin.app.vault.create(noteFilePath, content);
					await this.plugin.app.workspace.openLinkText(
						noteFilePath,
						"",
						true
					);
				} else {
					// Insert the transcription at the cursor position
					const editor =
						this.plugin.app.workspace.getActiveViewOfType(
							MarkdownView
						)?.editor;
					if (editor) {
						const cursorPosition = editor.getCursor();
						editor.replaceRange(formattedTranscription, cursorPosition);

						// Move the cursor to the end of the inserted text
						const newPosition = {
							line: cursorPosition.line,
							ch: cursorPosition.ch + formattedTranscription.length,
						};
						editor.setCursor(newPosition);
					}
				}
			}

			new Notice("Audio parsed successfully.");
		} catch (err) {
			console.error("Error parsing audio:", err);
			new Notice("Error parsing audio: " + err.message);
		}
	}

	private formatTranscriptionWithTimestamps(segments: any[]): string {
		let formatted = "";
		let currentParagraph = "";
		let lastEndTime = 0;

		segments.forEach((segment, index) => {
			const startTime = this.formatTime(segment.start);
			const text = segment.text.trim();

			// Check if this is a new paragraph (gap > threshold seconds or punctuation ending)
			const isNewParagraph = 
				segment.start - lastEndTime > this.plugin.settings.paragraphBreakThreshold || 
				(currentParagraph && /[.!?]$/.test(currentParagraph.trim()));

			if (isNewParagraph && currentParagraph) {
				formatted += currentParagraph.trim() + "\n\n";
				currentParagraph = "";
			}

			// Add timestamp at the beginning of each paragraph
			if (!currentParagraph) {
				formatted += `**[${startTime}]** `;
			}

			currentParagraph += text + " ";
			lastEndTime = segment.end;
		});

		// Add the last paragraph
		if (currentParagraph) {
			formatted += currentParagraph.trim() + "\n";
		}

		return formatted;
	}

	private formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		} else {
			return `${minutes}:${secs.toString().padStart(2, '0')}`;
		}
	}

	private applyTemplate(audioFilePath: string, transcription: string, metadata?: MeetingMetadata): string {
		// Use template from metadata if provided, otherwise use settings
		const templateName = metadata?.meetingType || this.plugin.settings.selectedTemplate;
		const selectedTemplate = this.plugin.settings.meetingTemplates.find(
			t => t.name === templateName
		);
		
		if (!selectedTemplate) {
			// Fallback to default format
			return `![[${audioFilePath}]]\n\n${transcription}`;
		}

		// Get current date/time
		const now = new Date();
		const date = now.toLocaleDateString();
		const time = now.toLocaleTimeString();
		const dateTime = `${date} ${time}`;

		// Replace template variables
		let content = selectedTemplate.template;
		content = content.replace(/\{\{transcription\}\}/g, transcription);
		content = content.replace(/\{\{date\}\}/g, date);
		content = content.replace(/\{\{time\}\}/g, time);
		content = content.replace(/\{\{datetime\}\}/g, dateTime);
		content = content.replace(/\{\{notes\}\}/g, "");
		content = content.replace(/\{\{audio\}\}/g, ""); // Remove audio placeholder
		
		// Use metadata if provided
		if (metadata) {
			content = content.replace(/\{\{attendees\}\}/g, metadata.attendees || "");
			content = content.replace(/\{\{agenda\}\}/g, metadata.agenda || "");
		} else {
			content = content.replace(/\{\{attendees\}\}/g, "");
			content = content.replace(/\{\{agenda\}\}/g, "");
		}

		return content;
	}
}
