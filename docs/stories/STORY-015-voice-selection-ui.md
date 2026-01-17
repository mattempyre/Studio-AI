# STORY-015: Voice Selection UI

**Epic:** Voice Generation (EPIC-03)
**Priority:** Must Have
**Story Points:** 2
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to select from different voices**
So that **I can pick one that fits my content's tone and style**

---

## Description

### Background
Different video content benefits from different voice characteristics. A documentary might need a calm, authoritative voice, while an educational video for kids might need an energetic, friendly voice. Chatterbox provides multiple voice options that users can preview and select.

### Scope
**In scope:**
- Voice selector dropdown in project settings
- List of available Chatterbox voices
- Voice preview samples (pre-recorded clips)
- Selected voice stored in project settings
- Voice ID passed to audio generation

**Out of scope:**
- Voice cloning from user samples
- Voice customization (speed, pitch)
- Per-section voice assignment
- Multi-voice narration

### User Flow
1. User opens project settings
2. User sees voice selector dropdown
3. Each voice shows name and brief description
4. User can click play icon to hear sample
5. User selects desired voice
6. Voice selection saved to project
7. All future audio generation uses selected voice

---

## Acceptance Criteria

- [ ] Voice selector dropdown in project settings panel
- [ ] Dropdown lists all available Chatterbox voices
- [ ] Each voice shows: name, description, play button
- [ ] Play button plays pre-recorded voice sample (2-3 seconds)
- [ ] Sample audio stops when another play button clicked
- [ ] Selected voice highlighted in dropdown
- [ ] Changing voice updates project `voiceId` field
- [ ] Default voice is "puck" for new projects
- [ ] Voice samples stored in `public/voices/` directory
- [ ] API endpoint returns available voices: `GET /api/v1/voices`
- [ ] Project settings persist voice selection across sessions

---

## Technical Notes

### Components
- **UI:** `src/components/ProjectSettings/VoiceSelector.tsx`
- **API:** `src/backend/api/voices.ts`

### Available Voices

| Voice ID | Name | Description |
|----------|------|-------------|
| puck | Puck | Neutral, professional narrator voice |
| kore | Kore | Warm, friendly female voice |
| fenrir | Fenrir | Deep, authoritative male voice |
| charon | Charon | Calm, soothing voice for meditation |
| zephyr | Zephyr | Energetic, youthful voice |

### API Endpoint

```
GET /api/v1/voices

Response (200):
{
  "voices": [
    {
      "id": "puck",
      "name": "Puck",
      "description": "Neutral, professional narrator voice",
      "sampleUrl": "/voices/puck-sample.wav"
    },
    {
      "id": "kore",
      "name": "Kore",
      "description": "Warm, friendly female voice",
      "sampleUrl": "/voices/kore-sample.wav"
    },
    ...
  ]
}
```

### Voice Selector Component

```tsx
// VoiceSelector.tsx
interface Voice {
  id: string;
  name: string;
  description: string;
  sampleUrl: string;
}

function VoiceSelector({ selectedVoiceId, onSelect }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch('/api/v1/voices')
      .then(res => res.json())
      .then(data => setVoices(data.voices));
  }, []);

  const playingSample = (voice: Voice) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingId === voice.id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(voice.sampleUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(voice.id);

    audio.onended = () => setPlayingId(null);
  };

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

  return (
    <div className="voice-selector">
      <label className="block text-sm font-medium mb-2">Narrator Voice</label>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 border rounded"
        >
          <span>{selectedVoice?.name || 'Select voice'}</span>
          <ChevronDownIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full bg-white border rounded-b shadow-lg z-10">
            {voices.map((voice) => (
              <div
                key={voice.id}
                className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer ${
                  voice.id === selectedVoiceId ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  onSelect(voice.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex-1">
                  <div className="font-medium">{voice.name}</div>
                  <div className="text-sm text-gray-500">{voice.description}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playingSample(voice);
                  }}
                  className="p-2 hover:bg-gray-200 rounded-full"
                >
                  {playingId === voice.id ? (
                    <StopIcon className="w-5 h-5" />
                  ) : (
                    <PlayIcon className="w-5 h-5" />
                  )}
                </button>
                {voice.id === selectedVoiceId && (
                  <CheckIcon className="w-5 h-5 text-blue-500 ml-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedVoice && (
        <p className="text-sm text-gray-500 mt-1">{selectedVoice.description}</p>
      )}
    </div>
  );
}
```

### Integration with Project Settings

```tsx
// ProjectSettings.tsx
function ProjectSettings({ project, onUpdate }: ProjectSettingsProps) {
  const handleVoiceChange = async (voiceId: string) => {
    await fetch(`/api/v1/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({ voiceId }),
    });
    onUpdate({ ...project, voiceId });
  };

  return (
    <div className="project-settings p-4">
      <h2 className="text-lg font-bold mb-4">Project Settings</h2>

      {/* ... other settings ... */}

      <VoiceSelector
        selectedVoiceId={project.voiceId}
        onSelect={handleVoiceChange}
      />

      {/* ... more settings ... */}
    </div>
  );
}
```

### Voice Sample Files

Create sample files for each voice:

```
public/
  voices/
    puck-sample.wav     (2-3 second sample)
    kore-sample.wav
    fenrir-sample.wav
    charon-sample.wav
    zephyr-sample.wav
```

Sample text: "Hello! This is a sample of my voice. I hope you enjoy using it for your projects."

### Generating Voice Samples

```bash
# Generate samples using Chatterbox CLI or API during setup
curl -X POST http://localhost:8004/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello! This is a sample of my voice.", "voice": "puck"}' \
  --output public/voices/puck-sample.wav
```

### Accessibility
- Keyboard navigation for dropdown
- Screen reader labels for play buttons
- Focus management when dropdown opens
- Audio control via keyboard (space to play/pause)

---

## Dependencies

**Prerequisite Stories:**
- STORY-008: Project CRUD API (project voiceId field)
- STORY-004: Chatterbox TTS Client (voice list)

**Blocked Stories:**
- STORY-016: Bulk Audio Generation (uses selected voice)

**External Dependencies:**
- Pre-recorded voice sample files
- Chatterbox running (for sample generation)

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Voice list fetching
  - [ ] Selection state management
  - [ ] Audio playback toggle
- [ ] Integration tests passing
  - [ ] Voice selection saves to project
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Voice descriptions
- [ ] Voice samples created for all voices
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of audio playback

---

## Story Points Breakdown

- **Voice selector component:** 1 point
- **Audio playback logic:** 0.5 points
- **API endpoint & integration:** 0.5 points
- **Total:** 2 points

**Rationale:** Standard dropdown with audio playback. Browser audio API handles most complexity.

---

## Additional Notes

Future enhancements:
- Voice preview with custom text input
- Voice speed/pitch adjustment
- Multi-voice assignment per character
- Voice cloning from user samples

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
