# STORY-021: Camera Movement Controls

**Epic:** Video Generation (EPIC-05)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **to select camera movements for each scene**
So that **each scene has appropriate motion that enhances the narrative**

---

## Description

### Background
Different scenes benefit from different camera movements. An establishing shot might zoom out, while a dramatic moment might push in. The camera movement selector lets creators choose movement type and intensity for each scene, which feeds into video generation.

### Scope
**In scope:**
- Camera movement dropdown in scene inspector
- Movement options: Static, Pan Left/Right, Zoom In/Out, Orbit, Truck
- Motion strength slider (0-100%)
- Settings stored on sentence record
- Settings passed to video generation
- Preview indicators showing movement direction

**Out of scope:**
- Custom keyframe animation
- Multiple movements per scene
- Movement timing control
- Real-time preview of movement

### User Flow
1. User opens scene in storyboard inspector
2. User clicks VIDEO tab
3. User sees camera movement dropdown
4. User selects movement type
5. User adjusts motion strength slider
6. Settings auto-save
7. When video generates, movement is applied
8. User can see movement icon on scene card

---

## Acceptance Criteria

- [ ] Camera movement dropdown in scene inspector VIDEO tab
- [ ] Options: Static, Pan Left, Pan Right, Zoom In, Zoom Out, Orbit, Truck
- [ ] Each option shows icon and descriptive tooltip
- [ ] Motion strength slider (0-100%, default 50%)
- [ ] Slider shows percentage label
- [ ] Changes auto-save to sentence record
- [ ] Changing movement sets `isVideoDirty: true`
- [ ] Scene card shows movement icon indicator
- [ ] Default values: `cameraMovement: 'static'`, `motionStrength: 0.5`
- [ ] Movement stored in sentence `cameraMovement` field
- [ ] Strength stored in sentence `motionStrength` field

---

## Technical Notes

### Components
- **UI:** `src/components/Storyboard/CameraMovementSelector.tsx`
- **UI:** `src/components/Storyboard/MotionStrengthSlider.tsx`
- **Icons:** Movement direction indicators

### Movement Options

```typescript
const CAMERA_MOVEMENTS = [
  {
    id: 'static',
    name: 'Static',
    description: 'No camera movement',
    icon: '⬜',  // Or custom SVG
  },
  {
    id: 'pan_left',
    name: 'Pan Left',
    description: 'Camera pans from right to left',
    icon: '⬅️',
  },
  {
    id: 'pan_right',
    name: 'Pan Right',
    description: 'Camera pans from left to right',
    icon: '➡️',
  },
  {
    id: 'zoom_in',
    name: 'Zoom In',
    description: 'Camera pushes in toward subject',
    icon: '🔍',
  },
  {
    id: 'zoom_out',
    name: 'Zoom Out',
    description: 'Camera pulls back from subject',
    icon: '🔎',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Camera rotates around subject',
    icon: '🔄',
  },
  {
    id: 'truck',
    name: 'Truck',
    description: 'Camera moves laterally',
    icon: '↔️',
  },
];
```

### Camera Movement Selector

```tsx
// CameraMovementSelector.tsx
function CameraMovementSelector({ value, onChange, disabled }: CameraSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = CAMERA_MOVEMENTS.find(m => m.id === value) || CAMERA_MOVEMENTS[0];

  return (
    <div className="camera-movement-selector">
      <label className="block text-sm font-medium mb-1">Camera Movement</label>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 border rounded"
      >
        <span className="flex items-center gap-2">
          <span>{selected.icon}</span>
          <span>{selected.name}</span>
        </span>
        <ChevronDownIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full bg-white border rounded shadow-lg z-10">
          {CAMERA_MOVEMENTS.map((movement) => (
            <div
              key={movement.id}
              onClick={() => {
                onChange(movement.id);
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                movement.id === value ? 'bg-blue-50' : ''
              }`}
            >
              <span className="text-xl">{movement.icon}</span>
              <div>
                <div className="font-medium">{movement.name}</div>
                <div className="text-xs text-gray-500">{movement.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Motion Strength Slider

```tsx
// MotionStrengthSlider.tsx
function MotionStrengthSlider({ value, onChange, disabled }: SliderProps) {
  const percentage = Math.round(value * 100);

  return (
    <div className="motion-strength-slider">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium">Motion Strength</label>
        <span className="text-sm text-gray-500">{percentage}%</span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={percentage}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        disabled={disabled}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Subtle</span>
        <span>Intense</span>
      </div>
    </div>
  );
}
```

### Integration in Scene Inspector

```tsx
// SceneInspector.tsx - VIDEO tab content
function VideoTabContent({ sentence, onUpdate }: VideoTabProps) {
  const handleMovementChange = (cameraMovement: string) => {
    onUpdate({
      cameraMovement,
      isVideoDirty: true,
    });
  };

  const handleStrengthChange = (motionStrength: number) => {
    onUpdate({
      motionStrength,
      isVideoDirty: true,
    });
  };

  return (
    <div className="video-tab space-y-4">
      {/* Video preview */}
      <div className="video-preview">
        {sentence.videoFile ? (
          <video
            src={sentence.videoFile}
            controls
            className="w-full rounded"
          />
        ) : (
          <div className="bg-gray-200 h-40 flex items-center justify-center rounded">
            No video generated
          </div>
        )}
      </div>

      {/* Camera controls */}
      <CameraMovementSelector
        value={sentence.cameraMovement}
        onChange={handleMovementChange}
      />

      <MotionStrengthSlider
        value={sentence.motionStrength}
        onChange={handleStrengthChange}
      />

      {/* Video prompt editor */}
      <VideoPromptEditor
        prompt={sentence.videoPrompt || ''}
        onChange={(videoPrompt) => onUpdate({ videoPrompt, isVideoDirty: true })}
      />

      {/* Regenerate button */}
      <button
        onClick={() => regenerateVideo(sentence.id)}
        disabled={!sentence.imageFile}
        className="btn-primary w-full"
      >
        {sentence.videoFile ? 'Regenerate Video' : 'Generate Video'}
      </button>
    </div>
  );
}
```

### Scene Card Movement Indicator

```tsx
// SceneCard.tsx
function SceneCard({ sentence }: SceneCardProps) {
  const movement = CAMERA_MOVEMENTS.find(m => m.id === sentence.cameraMovement);

  return (
    <div className="scene-card">
      {/* Thumbnail */}
      <img src={sentence.imageFile || '/placeholder.png'} />

      {/* Movement indicator */}
      {movement && movement.id !== 'static' && (
        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
          {movement.icon} {movement.name}
        </div>
      )}

      {/* ... rest of card */}
    </div>
  );
}
```

### API Update

```typescript
// PUT /api/v1/sentences/:id
// Already supports cameraMovement and motionStrength fields
{
  "cameraMovement": "zoom_in",
  "motionStrength": 0.7,
  "isVideoDirty": true
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-020: Video Generation Job (uses movement params)
- STORY-025: Scene Inspector Panel (contains controls)

**Blocked Stories:**
- STORY-022: Video Regeneration (uses movement settings)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Movement selector state
  - [ ] Slider value mapping
  - [ ] Update propagation
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Movement descriptions
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of all movements

---

## Story Points Breakdown

- **Movement selector component:** 1.5 points
- **Strength slider:** 0.5 points
- **Scene card indicator:** 0.5 points
- **Integration & state management:** 0.5 points
- **Total:** 3 points

**Rationale:** UI-focused story with clear component requirements. Movement options are predefined, keeping complexity manageable.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
