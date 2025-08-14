import axios from "axios";
import MoneyPenny from "main";
import { Notice, MarkdownView, TFile } from "obsidian";
import { getBaseFileName } from "./utils";
import { MeetingMetadata } from "./MeetingMetadataModal";
import { AIAnalysisService } from "./AIAnalysisService";
import { AudioChunker } from "./AudioChunker";

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

		// Check file size and warn user
		const sizeInMB = AudioChunker.getSizeInMB(blob);
		const estimatedDuration = AudioChunker.estimateDuration(blob);
		
		if (this.plugin.settings.debugMode) {
			new Notice(`Audio size: ${sizeInMB.toFixed(2)} MB, Est. duration: ${AudioChunker.formatDuration(estimatedDuration)}`);
		}

		// Check if chunking is needed
		if (AudioChunker.needsChunking(blob)) {
			new Notice(`Recording is ${sizeInMB.toFixed(1)}MB (>25MB limit). Processing in chunks...`, 5000);
			await this.processChunkedAudio(blob, fileName, metadata, existingNoteFile);
			return;
		}

		// Warn if approaching limit
		if (AudioChunker.isApproachingLimit(blob)) {
			new Notice(`Warning: Recording is ${sizeInMB.toFixed(1)}MB, approaching 25MB limit`, 3000);
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

			// Save the transcription using the new method
			await this.saveTranscription(formattedTranscription, fileName, metadata, existingNoteFile);

			new Notice("Audio parsed successfully.");
		} catch (err) {
			console.error("Error parsing audio:", err);
			new Notice("Error parsing audio: " + err.message);
		}
	}

	async processChunkedAudio(blob: Blob, fileName: string, metadata?: MeetingMetadata, existingNoteFile?: string): Promise<void> {
		const chunks = await AudioChunker.chunkAudioBySize(blob);
		const transcriptions: string[] = [];
		
		new Notice(`Processing ${chunks.length} audio chunks...`);
		
		for (const chunk of chunks) {
			try {
				new Notice(`Processing chunk ${chunk.index + 1}/${chunks.length}...`);
				
				const formData = new FormData();
				formData.append("file", chunk.blob, fileName);
				formData.append("model", this.plugin.settings.model);
				formData.append("language", this.plugin.settings.language);
				if (this.plugin.settings.prompt)
					formData.append("prompt", this.plugin.settings.prompt);
				formData.append("response_format", "verbose_json");
				formData.append("timestamp_granularities", "segment");
				
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
				
				const transcriptionData = response.data;
				let chunkTranscription = "";
				
				// Adjust timestamps for chunk position
				if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
					// Adjust segment timestamps based on chunk position
					const adjustedSegments = transcriptionData.segments.map((seg: any) => ({
						...seg,
						start: seg.start + chunk.startTime,
						end: seg.end + chunk.startTime
					}));
					chunkTranscription = this.formatTranscriptionWithTimestamps(adjustedSegments);
				} else {
					chunkTranscription = transcriptionData.text || response.data;
				}
				
				transcriptions.push(chunkTranscription);
			} catch (err) {
				console.error(`Error processing chunk ${chunk.index + 1}:`, err);
				new Notice(`Error processing chunk ${chunk.index + 1}: ${err.message}`);
				// Continue with other chunks even if one fails
			}
		}
		
		if (transcriptions.length === 0) {
			new Notice("Failed to process any audio chunks");
			return;
		}
		
		// Combine all transcriptions
		const fullTranscription = transcriptions.join("\n\n---\n\n");
		
		// Save the transcription
		await this.saveTranscription(fullTranscription, fileName, metadata, existingNoteFile);
		new Notice("All chunks processed successfully!");
	}

	async saveTranscription(transcription: string, fileName: string, metadata?: MeetingMetadata, existingNoteFile?: string, isPasted: boolean = false): Promise<void> {
		const baseFileName = getBaseFileName(fileName);
		const audioFilePath = fileName;
		const noteFilePath = `${baseFileName}.md`;
		
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
					transcription
				);
				
				// Analyze the meeting if enabled
				if (this.plugin.settings.enableAIAnalysis) {
					await this.analyzeAndUpdateNote(existingFile, content, updatedContent, transcription);
				} else {
					// Write the updated content
					await this.plugin.app.vault.modify(existingFile, updatedContent);
				}
			}
		} else {
			// Original logic for creating new file or inserting at cursor
			const activeView =
				this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			// Always create a new file (removed the setting)
			const shouldCreateNewFile = true;

			if (shouldCreateNewFile) {
				let content: string;
				
				// Run AI analysis first if enabled
				let analysis = null;
				if (this.plugin.settings.enableAIAnalysis) {
					new Notice("Analyzing transcription with AI...");
					
					// Prepare analysis input
					let analysisInput = transcription;
					const existingParticipants = metadata?.attendees || "";
					const existingAgenda = metadata?.agenda || "";
					
					analysis = await this.aiService.analyzeMeeting(
						analysisInput,
						existingParticipants,
						existingAgenda
					);
				}
				
				// Now create content with analysis results
				if (this.plugin.settings.useMeetingTemplate) {
					content = this.applyTemplateWithAnalysis(audioFilePath, transcription, metadata, isPasted, analysis);
				} else {
					// Create basic structure for pasted transcriptions
					if (isPasted) {
						const now = new Date();
						content = `# Meeting Notes\n\n`;
						content += `**Date:** ${now.toLocaleDateString()}\n`;
						content += `**Time:** ${now.toLocaleTimeString()}\n\n`;
						if (metadata?.attendees || (analysis?.participants && analysis.participants.length > 0)) {
							const participants = metadata?.attendees || analysis?.participants?.join(', ') || "";
							content += `**Attendees:** ${participants}\n\n`;
						}
						if (metadata?.agenda || (analysis?.agenda && analysis.agenda.length > 0)) {
							const agenda = metadata?.agenda || analysis?.agenda?.map((item: string) => `- ${item}`).join('\n') || "";
							content += `**Agenda:**\n${agenda}\n\n`;
						}
						if (analysis) {
							if (analysis.keyPoints && analysis.keyPoints.length > 0) {
								content += `## Key Points\n${analysis.keyPoints.map(point => `- ${point}`).join('\n')}\n\n`;
							}
							if (analysis.actionItems && analysis.actionItems.length > 0) {
								content += `## Action Items\n${analysis.actionItems.map(item => {
									if (!item.startsWith('[ ]') && !item.startsWith('[x]')) {
										return `- [ ] ${item}`;
									}
									return `- ${item}`;
								}).join('\n')}\n\n`;
							}
							if (analysis.nextSteps && analysis.nextSteps.length > 0) {
								content += `## Next Steps\n${analysis.nextSteps.map(step => `- ${step}`).join('\n')}\n\n`;
							}
						}
						// Don't include transcription in final output for pasted content
					} else {
						// For recorded audio, still include transcription
						content = `![[${audioFilePath}]]\n\n${transcription}`;
					}
				}
				
				// Create the note with fully processed content
				await this.plugin.app.vault.create(noteFilePath, content);
				await this.plugin.app.workspace.openLinkText(
					noteFilePath,
					"",
					true
				);
				
				if (analysis) {
					new Notice("AI analysis complete!");
				}
			} else {
				// Insert the transcription at the cursor position
				const editor =
					this.plugin.app.workspace.getActiveViewOfType(
						MarkdownView
					)?.editor;
				if (editor) {
					const cursorPosition = editor.getCursor();
					editor.replaceRange(transcription, cursorPosition);

					// Move the cursor to the end of the inserted text
					const newPosition = {
						line: cursorPosition.line,
						ch: cursorPosition.ch + transcription.length,
					};
					editor.setCursor(newPosition);
				}
			}
		}
	}

	async analyzeAndUpdateNote(existingFile: TFile, content: string, updatedContent: string, transcription: string): Promise<void> {
		new Notice("Analyzing meeting with AI...");
		
		// Extract existing content from the note
		const notesMatch = content.match(/### Notes\n([\s\S]*?)(?=###|$)/);
		const participantsMatch = content.match(/### Participants\n([\s\S]*?)(?=###|$)/);
		const agendaMatch = content.match(/### Agenda\n([\s\S]*?)(?=###|$)/);
		
		const existingNotes = notesMatch ? notesMatch[1].trim() : "";
		const existingParticipants = participantsMatch ? participantsMatch[1].trim() : "";
		const existingAgenda = agendaMatch ? agendaMatch[1].trim() : "";
		
		// Combine transcription with notes for analysis
		let analysisInput = transcription;
		if (existingNotes) {
			analysisInput = `User Notes:\n${existingNotes}\n\nTranscription:\n${analysisInput}`;
		}
		
		const analysis = await this.aiService.analyzeMeeting(
			analysisInput,
			existingParticipants,
			existingAgenda
		);
		
		if (analysis) {
			// Update sections with analysis results
			if (analysis.participants && analysis.participants.length > 0) {
				const existingList = existingParticipants ? existingParticipants.split(',').map(p => p.trim()).filter(p => p) : [];
				const newParticipants = analysis.participants.filter(p => 
					!existingList.some(existing => existing.toLowerCase() === p.toLowerCase())
				);
				if (newParticipants.length > 0 || existingList.length === 0) {
					const allParticipants = [...existingList, ...newParticipants];
					const participantsText = allParticipants.join(', ');
					updatedContent = updatedContent.replace(
						/### Participants\n[^#]*/,
						`### Participants\n${participantsText}\n\n`
					);
				}
			}
			
			if (analysis.agenda && analysis.agenda.length > 0) {
				const existingItems = existingAgenda ? existingAgenda.split('\n')
					.map(line => line.replace(/^[-*]\s*/, '').trim())
					.filter(item => item && item !== '-') : [];
				const newItems = analysis.agenda.filter(item => 
					!existingItems.some(existing => existing.toLowerCase() === item.toLowerCase())
				);
				if (newItems.length > 0 || existingItems.length === 0) {
					const allItems = [...existingItems, ...newItems];
					const agendaText = allItems.map(item => `- ${item}`).join('\n');
					updatedContent = updatedContent.replace(
						/### Agenda\n[^#]*/,
						`### Agenda\n${agendaText}\n\n`
					);
				}
			}
			
			if (analysis.keyPoints.length > 0) {
				const keyPointsText = analysis.keyPoints.map(point => `- ${point}`).join('\n');
				updatedContent = updatedContent.replace(/### Key Points\n- /, `### Key Points\n${keyPointsText}`);
			}
			
			if (analysis.actionItems.length > 0) {
				const actionItemsText = analysis.actionItems.map(item => {
					if (!item.startsWith('[ ]') && !item.startsWith('[x]')) {
						return `- [ ] ${item}`;
					}
					return `- ${item}`;
				}).join('\n');
				updatedContent = updatedContent.replace(/### Action Items\n- \[ \] /, `### Action Items\n${actionItemsText}`);
			}
			
			if (analysis.nextSteps.length > 0) {
				const nextStepsText = analysis.nextSteps.map(step => `- ${step}`).join('\n');
				updatedContent = updatedContent.replace(/### Next Steps\n- /, `### Next Steps\n${nextStepsText}`);
			}
			
			new Notice("AI analysis complete!");
		}
		
		// Write the updated content
		await this.plugin.app.vault.modify(existingFile, updatedContent);
	}

	async handlePastedTranscription(transcription: string, metadata?: MeetingMetadata): Promise<void> {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = now.getHours();
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		
		const fileName = `${year}-${month}-${day} ${displayHours}.${minutes} ${ampm} - Pasted Transcription`;
		
		// Save the transcription with a flag indicating no audio file
		await this.saveTranscription(transcription, fileName, metadata, undefined, true);
		new Notice("Transcription saved successfully!");
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

	private applyTemplateWithAnalysis(audioFilePath: string, transcription: string, metadata?: MeetingMetadata, isPasted: boolean = false, analysis?: any): string {
		// Use template from metadata if provided, otherwise use settings
		const templateName = metadata?.meetingType || this.plugin.settings.selectedTemplate;
		const selectedTemplate = this.plugin.settings.meetingTemplates.find(
			t => t.name === templateName
		);
		
		if (!selectedTemplate) {
			// Fallback to default format
			return isPasted ? "" : `![[${audioFilePath}]]\n\n${transcription}`;
		}

		// Get current date/time
		const now = new Date();
		const date = now.toLocaleDateString();
		const time = now.toLocaleTimeString();
		const dateTime = `${date} ${time}`;

		// Replace template variables
		let content = selectedTemplate.template;
		// For pasted content, don't include the transcription in the final output
		if (isPasted) {
			// Remove the transcription section entirely for pasted content
			content = content.replace(/### Transcription\n\{\{transcription\}\}/g, "");
			content = content.replace(/\{\{transcription\}\}/g, "");
		} else {
			content = content.replace(/\{\{transcription\}\}/g, transcription);
		}
		content = content.replace(/\{\{date\}\}/g, date);
		content = content.replace(/\{\{time\}\}/g, time);
		content = content.replace(/\{\{datetime\}\}/g, dateTime);
		content = content.replace(/\{\{notes\}\}/g, "");
		content = content.replace(/\{\{audio\}\}/g, ""); // Remove audio placeholder
		
		// Use metadata and analysis results
		if (metadata?.attendees || (analysis && analysis.participants && analysis.participants.length > 0)) {
			const participants = metadata?.attendees || analysis.participants.join(', ');
			content = content.replace(/\{\{attendees\}\}/g, participants);
		} else {
			content = content.replace(/\{\{attendees\}\}/g, "");
		}
		
		if (metadata?.agenda || (analysis && analysis.agenda && analysis.agenda.length > 0)) {
			const agenda = metadata?.agenda || analysis.agenda.map((item: string) => `- ${item}`).join('\n');
			content = content.replace(/\{\{agenda\}\}/g, agenda);
		} else {
			content = content.replace(/\{\{agenda\}\}/g, "");
		}
		
		// Replace placeholder sections with AI analysis results
		if (analysis) {
			// Replace Key Points section
			if (analysis.keyPoints && analysis.keyPoints.length > 0) {
				const keyPointsText = analysis.keyPoints.map((point: string) => `- ${point}`).join('\n');
				content = content.replace(/### Key Points\n- ?/, `### Key Points\n${keyPointsText}`);
			}
			
			// Replace Action Items section
			if (analysis.actionItems && analysis.actionItems.length > 0) {
				const actionItemsText = analysis.actionItems.map((item: string) => {
					if (!item.startsWith('[ ]') && !item.startsWith('[x]')) {
						return `- [ ] ${item}`;
					}
					return `- ${item}`;
				}).join('\n');
				content = content.replace(/### Action Items\n- \[ \] ?/, `### Action Items\n${actionItemsText}`);
			}
			
			// Replace Next Steps section
			if (analysis.nextSteps && analysis.nextSteps.length > 0) {
				const nextStepsText = analysis.nextSteps.map((step: string) => `- ${step}`).join('\n');
				content = content.replace(/### Next Steps\n- ?/, `### Next Steps\n${nextStepsText}`);
			}
		}

		return content;
	}

	private applyTemplate(audioFilePath: string, transcription: string, metadata?: MeetingMetadata, isPasted: boolean = false): string {
		// Use template from metadata if provided, otherwise use settings
		const templateName = metadata?.meetingType || this.plugin.settings.selectedTemplate;
		const selectedTemplate = this.plugin.settings.meetingTemplates.find(
			t => t.name === templateName
		);
		
		if (!selectedTemplate) {
			// Fallback to default format
			return isPasted ? "" : `![[${audioFilePath}]]\n\n${transcription}`;
		}

		// Get current date/time
		const now = new Date();
		const date = now.toLocaleDateString();
		const time = now.toLocaleTimeString();
		const dateTime = `${date} ${time}`;

		// Replace template variables
		let content = selectedTemplate.template;
		// For pasted content, don't include the transcription in the final output
		if (isPasted) {
			// Remove the transcription section entirely for pasted content
			content = content.replace(/### Transcription\n\{\{transcription\}\}/g, "");
			content = content.replace(/\{\{transcription\}\}/g, "");
		} else {
			content = content.replace(/\{\{transcription\}\}/g, transcription);
		}
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