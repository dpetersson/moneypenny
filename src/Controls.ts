import MoneyPenny from "main";
import { ButtonComponent, Modal } from "obsidian";
import { RecordingStatus } from "./StatusBar";
import { MeetingMetadataModal } from "./MeetingMetadataModal";

export class Controls extends Modal {
	private plugin: MoneyPenny;
	private startButton: ButtonComponent;
	private pauseButton: ButtonComponent;
	private stopButton: ButtonComponent;
	private timerDisplay: HTMLElement;

	constructor(plugin: MoneyPenny) {
		super(plugin.app);
		this.plugin = plugin;
		this.containerEl.addClass("recording-controls");

		// Add elapsed time display
		this.timerDisplay = this.contentEl.createEl("div", { cls: "timer" });
		this.updateTimerDisplay();

		// Set onUpdate callback for the timer
		this.plugin.timer.setOnUpdate(() => {
			this.updateTimerDisplay();
		});

		// Add button group
		const buttonGroupEl = this.contentEl.createEl("div", {
			cls: "button-group",
		});

		// Add record button
		this.startButton = new ButtonComponent(buttonGroupEl);
		this.startButton
			.setIcon("microphone")
			.setButtonText(" Record")
			.onClick(this.startRecording.bind(this))
			.buttonEl.addClass("button-component");

		// Add pause button
		this.pauseButton = new ButtonComponent(buttonGroupEl);
		this.pauseButton
			.setIcon("pause")
			.setButtonText(" Pause")
			.onClick(this.pauseRecording.bind(this))
			.buttonEl.addClass("button-component");

		// Add stop button
		this.stopButton = new ButtonComponent(buttonGroupEl);
		this.stopButton
			.setIcon("square")
			.setButtonText(" Stop")
			.onClick(this.stopRecording.bind(this))
			.buttonEl.addClass("button-component");
	}

	async startRecording() {
		console.log("start");
		
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
					this.resetGUI();
				}
			).open();
		} else {
			await this.plugin.startRecordingWithNote();
			this.resetGUI();
		}
	}

	private async doStartRecording() {
		this.plugin.statusBar.updateStatus(RecordingStatus.Recording);
		await this.plugin.recorder.startRecording();
		this.plugin.timer.start();
		this.resetGUI();
	}

	async pauseRecording() {
		console.log("pausing recording...");
		await this.plugin.recorder.pauseRecording();
		this.plugin.timer.pause();
		this.resetGUI();
	}

	async stopRecording() {
		console.log("stopping recording...");
		this.plugin.timer.reset();
		await this.plugin.stopRecordingAndProcess();
		this.close();
	}

	updateTimerDisplay() {
		this.timerDisplay.textContent = this.plugin.timer.getFormattedTime();
	}

	resetGUI() {
		const recorderState = this.plugin.recorder.getRecordingState();

		this.startButton.setDisabled(
			recorderState === "recording" || recorderState === "paused"
		);
		this.pauseButton.setDisabled(recorderState === "inactive");
		this.stopButton.setDisabled(recorderState === "inactive");

		this.pauseButton.setButtonText(
			recorderState === "paused" ? " Resume" : " Pause"
		);
	}
}
