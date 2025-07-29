# MoneyPenny - AI-Powered Meeting Assistant for Obsidian 🎙️✨

<div align="center">
  <img src="moneypenny.png" alt="MoneyPenny" width="400">
</div>

MoneyPenny transforms your meetings into structured, actionable notes with AI-powered insights. Record, transcribe, and let AI extract key points, action items, and participants automatically.

## ✨ Features

### 🎙️ Smart Recording & Transcription
- **One-Click Recording**: Start recording with `Cmd+Shift+R` (Mac) or ribbon icon
- **Instant Note Creation**: Creates meeting notes immediately when recording starts
- **Timestamped Transcription**: Navigate through your meeting with timestamp markers
- **Smart Paragraphs**: Automatically breaks transcription into readable paragraphs

### 🤖 AI-Powered Analysis
- **Participant Detection**: Automatically identifies meeting attendees from transcription
- **Agenda Extraction**: Discovers discussion topics and meeting purposes
- **Key Points**: Extracts 3-5 main topics or decisions
- **Action Items**: Captures tasks with owner assignments
- **Next Steps**: Identifies follow-up actions and future plans

### 📝 Meeting Templates
- **General Meeting**: Standard format for most meetings
- **Daily Standup**: Yesterday/Today/Blockers format
- **One-on-One**: Feedback and follow-up focused template
- **Customizable**: Edit templates in `templates/` folder

### 🎯 Smart Features
- **Live Note-Taking**: Add notes during recording that AI considers in analysis
- **Append Mode**: AI adds new participants/agenda items without overwriting
- **Template Selection**: Choose meeting type before recording
- **Immediate Access**: Note opens automatically for real-time editing

## 🚀 Getting Started

### Installation
1. Install MoneyPenny from Obsidian Community Plugins
2. Enable the plugin in Settings → Community Plugins
3. Configure your OpenAI API key

### Configuration
1. Go to Settings → MoneyPenny
2. Enter your OpenAI API key (used for both transcription and AI analysis)
3. Enable AI Analysis for meeting insights
4. Customize templates if desired

## 📋 Usage

### Recording a Meeting
1. Press `Cmd+Shift+R` (Mac) or click the microphone icon
2. (Optional) Select meeting template when prompted
3. Start speaking - a note is created immediately
4. Add manual notes during the meeting in the "Notes" section
5. Stop recording when done
6. AI analyzes and populates the note automatically

### Meeting Note Structure
```markdown
### Participants
[AI extracts attendees]

### Agenda  
[AI identifies topics]

### Notes
[Your manual notes during meeting]

### Key Points
- [AI extracts main decisions/topics]

### Action Items
- [ ] [AI extracts tasks with owners]

### Next Steps
- [AI identifies follow-ups]

### Transcription
[Timestamped meeting transcript]
```

## ⚙️ Settings

### Core Settings
- **API Key**: Your OpenAI API key (required)
- **Model**: Transcription model (default: whisper-1)
- **Language**: Transcription language (default: en)

### Meeting Features
- **Use Meeting Templates**: Enable structured note templates
- **Prompt for Meeting Type**: Show template selector before recording
- **Paragraph Break Threshold**: Seconds of silence for new paragraph (default: 2)

### AI Analysis
- **Enable AI Analysis**: Extract insights from meetings
- **AI Model**: GPT model for analysis (default: gpt-4o-mini)

## 📝 Template Customization

Edit templates in the `templates/` folder:
1. Modify `.md` files in `templates/` directory
2. Run `npm run build` to update
3. Templates support variables:
   - `{{attendees}}`, `{{agenda}}`, `{{notes}}`
   - `{{transcription}}`, `{{date}}`, `{{time}}`

## 🔧 Advanced Features

### Keyboard Shortcuts
- `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows/Linux): Start/stop recording

### Debug Mode
Enable in settings to see:
- Audio file size being sent
- Processing status notifications

## 🔐 Security & Privacy

### API Key Encryption
- **New in v0.1.0**: API keys are now encrypted using AES-256-GCM encryption
- Encryption key is derived from your vault path, making keys vault-specific
- Provides protection against casual file browsing
- Automatic backward compatibility with existing plain-text keys

### API Key Storage
- API keys are stored encrypted in `.obsidian/plugins/moneypenny/data.json`
- This file is automatically excluded from git (via .gitignore)
- Encryption prevents plain-text exposure of your API key
- Keys are tied to your specific vault location

### Best Practices
1. Use a dedicated API key for MoneyPenny
2. Set appropriate usage limits in your OpenAI account
3. Regularly rotate your API keys
4. Never commit data.json to version control
5. If moving vaults, re-enter your API key (encryption is vault-specific)

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

MoneyPenny is built on the foundation of the whisper-obsidian-plugin. Special thanks to the original developers for their excellent speech-to-text implementation.

---

*MoneyPenny: Your AI meeting assistant that never misses a detail* 🎯
