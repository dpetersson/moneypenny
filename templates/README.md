# Meeting Templates

This directory contains the meeting templates used by MoneyPenny. Each `.md` file represents a different meeting type.

## How to Edit Templates

1. Edit any `.md` file in this directory
2. Run `npm run build` (or `npm run build-templates`)
3. The templates will be compiled into `src/templates.json` automatically

## Available Variables

Templates can use the following variables:
- `{{attendees}}` - Meeting participants
- `{{agenda}}` - Meeting agenda/topics
- `{{notes}}` - User notes taken during meeting
- `{{transcription}}` - The transcribed audio
- `{{date}}` - Current date
- `{{time}}` - Current time
- `{{datetime}}` - Combined date and time

## Adding New Templates

1. Create a new `.md` file in this directory (e.g., `retrospective.md`)
2. Add your template content with variables
3. Run the build
4. The template will automatically appear in the settings dropdown