import { Plugin } from "obsidian";
import * as templateData from './templates.json';

export interface MeetingTemplate {
	name: string;
	template: string;
}

export interface MoneyPennySettings {
	apiKey: string;
	apiUrl: string;
	model: string;
	prompt: string;
	language: string;
	debugMode: boolean;
	paragraphBreakThreshold: number;
	useMeetingTemplate: boolean;
	selectedTemplate: string;
	meetingTemplates: MeetingTemplate[];
	promptForMetadata: boolean;
	defaultAttendees: string;
	enableAIAnalysis: boolean;
	aiModel: string;
	aiPrompt: string;
}

export const DEFAULT_SETTINGS: MoneyPennySettings = {
	apiKey: "",
	apiUrl: "https://api.openai.com/v1/audio/transcriptions",
	model: "whisper-1",
	prompt: "",
	language: "en",
	debugMode: false,
	paragraphBreakThreshold: 2,
	useMeetingTemplate: false,
	selectedTemplate: "general",
	promptForMetadata: true,
	defaultAttendees: "",
	enableAIAnalysis: false,
	aiModel: "gpt-4o-mini",
	aiPrompt: `Analyze this meeting transcription and any provided notes to extract:

1. **Participants**: List all people mentioned or speaking in the meeting
2. **Agenda**: Main topics or purpose of the meeting (2-3 bullet points)
3. **Key Points**: 3-5 main topics or decisions discussed
4. **Action Items**: Specific tasks with owners if mentioned (format as "- [ ] Task description @owner")
5. **Next Steps**: Future actions or follow-ups discussed

Be concise and focus on actionable insights. If notes are provided, prioritize information from the notes over the transcription.`,
	meetingTemplates: Object.entries(templateData).map(([name, template]) => ({
		name,
		template: template as string
	}))
};

export class SettingsManager {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async loadSettings(): Promise<MoneyPennySettings> {
		const savedData = await this.plugin.loadData();
		const settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			savedData
		);
		
		// Always use the latest templates from source, not saved data
		settings.meetingTemplates = DEFAULT_SETTINGS.meetingTemplates;
		
		return settings;
	}

	async saveSettings(settings: MoneyPennySettings): Promise<void> {
		await this.plugin.saveData(settings);
	}
}
