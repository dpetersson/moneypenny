import { App, Modal, Setting } from "obsidian";
import { MeetingTemplate } from "./SettingsManager";

export interface MeetingMetadata {
	attendees: string;
	agenda: string;
	meetingType: string;
}

export class MeetingMetadataModal extends Modal {
	result: MeetingMetadata;
	onSubmit: (result: MeetingMetadata) => void;
	selectedTemplate: string;
	availableTemplates: MeetingTemplate[];

	constructor(
		app: App, 
		defaultAttendees: string, 
		selectedTemplate: string,
		availableTemplates: MeetingTemplate[],
		onSubmit: (result: MeetingMetadata) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.selectedTemplate = selectedTemplate;
		this.availableTemplates = availableTemplates;
		this.result = {
			attendees: "",
			agenda: "",
			meetingType: selectedTemplate
		};
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Select Meeting Type" });

		new Setting(contentEl)
			.setName("Meeting Template")
			.setDesc("Choose the template for this meeting")
			.addDropdown((dropdown) => {
				// Add all available templates from settings
				this.availableTemplates.forEach(template => {
					// Create user-friendly display names
					const displayName = template.name
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');
					dropdown.addOption(template.name, displayName);
				});
				
				dropdown
					.setValue(this.result.meetingType)
					.onChange((value) => {
						this.result.meetingType = value;
					});
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Start Recording")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.result);
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}