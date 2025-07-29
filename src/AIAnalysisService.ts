import axios from "axios";
import MoneyPenny from "main";
import { Notice } from "obsidian";

export interface MeetingAnalysis {
	participants?: string[];
	agenda?: string[];
	keyPoints: string[];
	actionItems: string[];
	nextSteps: string[];
	rawResponse?: string;
}

export class AIAnalysisService {
	private plugin: MoneyPenny;

	constructor(plugin: MoneyPenny) {
		this.plugin = plugin;
	}

	async analyzeMeeting(transcription: string, existingParticipants?: string, existingAgenda?: string): Promise<MeetingAnalysis | null> {
		if (!this.plugin.settings.enableAIAnalysis) {
			return null;
		}

		if (!this.plugin.settings.apiKey) {
			new Notice("API key is missing. Please add your API key in the settings.");
			return null;
		}

		try {
			// Use chat completions endpoint
			const apiUrl = this.plugin.settings.apiUrl.replace('/audio/transcriptions', '/chat/completions');
			const response = await axios.post(
				apiUrl,
				{
					model: this.plugin.settings.aiModel,
					messages: [
						{
							role: "system",
							content: this.plugin.settings.aiPrompt
						},
						{
							role: "user",
							content: transcription
						}
					],
					temperature: 0.7,
					max_tokens: 1000
				},
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.plugin.settings.apiKey}`,
					},
				}
			);

			const aiResponse = response.data.choices[0].message.content;
			return this.parseAIResponse(aiResponse);

		} catch (error) {
			console.error("Error analyzing meeting:", error);
			new Notice("Error analyzing meeting: " + error.message);
			return null;
		}
	}

	private parseAIResponse(response: string): MeetingAnalysis {
		const analysis: MeetingAnalysis = {
			participants: [],
			agenda: [],
			keyPoints: [],
			actionItems: [],
			nextSteps: [],
			rawResponse: response
		};

		// Split response into sections
		const sections = response.split(/\*\*(Participants|Agenda|Key Points|Action Items|Next Steps)\*\*:/i);
		
		for (let i = 1; i < sections.length; i += 2) {
			const sectionTitle = sections[i].toLowerCase();
			const sectionContent = sections[i + 1];
			
			if (sectionContent) {
				// Extract bullet points
				const items = sectionContent
					.split('\n')
					.filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
					.map(line => line.trim().substring(1).trim());

				if (sectionTitle.includes('participant')) {
					// For participants, handle comma-separated lists
					const participantsList = sectionContent.trim()
						.split('\n')
						.filter(line => line.trim())
						.join(', ')
						.split(/[,;]/)
						.map(p => p.trim())
						.filter(p => p && p !== '-');
					analysis.participants = participantsList;
				} else if (sectionTitle.includes('agenda')) {
					analysis.agenda = items;
				} else if (sectionTitle.includes('key point')) {
					analysis.keyPoints = items;
				} else if (sectionTitle.includes('action item')) {
					analysis.actionItems = items;
				} else if (sectionTitle.includes('next step')) {
					analysis.nextSteps = items;
				}
			}
		}

		// Fallback: if parsing fails, try to extract any bullet points
		if (analysis.keyPoints.length === 0 && analysis.actionItems.length === 0 && analysis.nextSteps.length === 0) {
			const allBullets = response
				.split('\n')
				.filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
				.map(line => line.trim().substring(1).trim());
			
			// Distribute bullets based on keywords
			allBullets.forEach(bullet => {
				const lower = bullet.toLowerCase();
				if (lower.includes('action') || lower.includes('task') || lower.includes('[ ]')) {
					analysis.actionItems.push(bullet);
				} else if (lower.includes('next') || lower.includes('follow')) {
					analysis.nextSteps.push(bullet);
				} else {
					analysis.keyPoints.push(bullet);
				}
			});
		}

		return analysis;
	}
}