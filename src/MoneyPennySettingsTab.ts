import MoneyPenny from "main";
import { App, PluginSettingTab, Setting, TFolder } from "obsidian";
import { SettingsManager } from "./SettingsManager";

export class MoneyPennySettingsTab extends PluginSettingTab {
	private plugin: MoneyPenny;
	private settingsManager: SettingsManager;

	constructor(app: App, plugin: MoneyPenny) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = plugin.settingsManager;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		this.createHeader();
		this.createApiKeySetting();
		this.createApiUrlSetting();
		this.createModelSetting();
		this.createPromptSetting();
		this.createLanguageSetting();
		this.createParagraphBreakThresholdSetting();
		this.createMeetingTemplateToggleSetting();
		this.createTemplateSelectionSetting();
		this.createMetadataPromptToggleSetting();
		this.createAIAnalysisToggleSetting();
		this.createAIModelSetting();
		this.createDebugModeToggleSetting();
	}

	private getUniqueFolders(): TFolder[] {
		const files = this.app.vault.getMarkdownFiles();
		const folderSet = new Set<TFolder>();

		for (const file of files) {
			const parentFolder = file.parent;
			if (parentFolder && parentFolder instanceof TFolder) {
				folderSet.add(parentFolder);
			}
		}

		return Array.from(folderSet);
	}

	private createHeader(): void {
		this.containerEl.createEl("h2", { text: "Settings for MoneyPenny" });
	}

	private createTextSetting(
		name: string,
		desc: string,
		placeholder: string,
		value: string,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange(async (value) => await onChange(value))
			);
	}

	private createApiKeySetting(): void {
		new Setting(this.containerEl)
			.setName("API Key")
			.setDesc("Enter your OpenAI API key")
			.addText((text) => {
				text
					.setPlaceholder("sk-...xxxx")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.settingsManager.saveSettings(this.plugin.settings);
					});
				text.inputEl.type = 'password';
			});
	}

	private createApiUrlSetting(): void {
		this.createTextSetting(
			"API URL",
			"Specify the endpoint that will be used to make requests to",
			"https://api.your-custom-url.com",
			this.plugin.settings.apiUrl,
			async (value) => {
				this.plugin.settings.apiUrl = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createModelSetting(): void {
		this.createTextSetting(
			"Model",
			"Specify the machine learning model to use for generating text",
			"whisper-1",
			this.plugin.settings.model,
			async (value) => {
				this.plugin.settings.model = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createPromptSetting(): void {
		this.createTextSetting(
			"Prompt",
			"Optional: Add words with their correct spellings to help with transcription. Make sure it matches the chosen language.",
			"Example: ZyntriQix, Digique Plus, CynapseFive",
			this.plugin.settings.prompt,
			async (value) => {
				this.plugin.settings.prompt = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createLanguageSetting(): void {
		this.createTextSetting(
			"Language",
			"Specify the language of the message being whispered",
			"en",
			this.plugin.settings.language,
			async (value) => {
				this.plugin.settings.language = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}



	private createParagraphBreakThresholdSetting(): void {
		new Setting(this.containerEl)
			.setName("Paragraph break threshold")
			.setDesc(
				"Seconds of silence before creating a new paragraph"
			)
			.addText((text) =>
				text
					.setPlaceholder("2")
					.setValue(String(this.plugin.settings.paragraphBreakThreshold))
					.onChange(async (value) => {
						const numValue = parseFloat(value);
						if (!isNaN(numValue) && numValue >= 0) {
							this.plugin.settings.paragraphBreakThreshold = numValue;
							await this.settingsManager.saveSettings(
								this.plugin.settings
							);
						}
					})
			);
	}

	private createMeetingTemplateToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Use meeting templates")
			.setDesc(
				"Apply structured templates to your meeting notes"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useMeetingTemplate)
					.onChange(async (value) => {
						this.plugin.settings.useMeetingTemplate = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
						// Refresh the display to show/hide template selection
						this.display();
					});
			});
	}

	private createTemplateSelectionSetting(): void {
		if (!this.plugin.settings.useMeetingTemplate) {
			return; // Don't show template selection if templates are disabled
		}

		// Only show if metadata prompt is disabled (otherwise it's selected in the modal)
		if (this.plugin.settings.promptForMetadata) {
			return;
		}

		new Setting(this.containerEl)
			.setName("Default meeting template")
			.setDesc(
				"Select the default template to use for new meeting notes"
			)
			.addDropdown((dropdown) => {
				// Add all available templates to the dropdown
				this.plugin.settings.meetingTemplates.forEach(template => {
					dropdown.addOption(template.name, template.name);
				});
				
				dropdown
					.setValue(this.plugin.settings.selectedTemplate)
					.onChange(async (value) => {
						this.plugin.settings.selectedTemplate = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}

	private createMetadataPromptToggleSetting(): void {
		if (!this.plugin.settings.useMeetingTemplate) {
			return; // Don't show if templates are disabled
		}

		new Setting(this.containerEl)
			.setName("Prompt for meeting type")
			.setDesc(
				"Show dialog to select template before recording"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.promptForMetadata)
					.onChange(async (value) => {
						this.plugin.settings.promptForMetadata = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
						// Refresh display to show/hide default attendees
						this.display();
					});
			});
	}


	private createAIAnalysisToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Enable AI meeting analysis")
			.setDesc(
				"Automatically extract key points, action items, and next steps from transcriptions"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableAIAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enableAIAnalysis = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
						// Refresh display to show/hide AI settings
						this.display();
					});
			});
	}


	private createAIModelSetting(): void {
		if (!this.plugin.settings.enableAIAnalysis) {
			return;
		}

		this.createTextSetting(
			"AI Model",
			"Model to use for analysis (e.g., gpt-4o-mini, gpt-3.5-turbo)",
			"gpt-4o-mini",
			this.plugin.settings.aiModel,
			async (value) => {
				this.plugin.settings.aiModel = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createDebugModeToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Debug Mode")
			.setDesc(
				"Turn on to increase the plugin's verbosity for troubleshooting."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}
}
