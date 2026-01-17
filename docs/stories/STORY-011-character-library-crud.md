# STORY-011: Character Library CRUD

**Epic:** Character System (EPIC-02)
**Priority:** Must Have
**Story Points:** 3
**Status:** Completed
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to manage a library of characters**
So that **I can reuse consistent characters across projects**

---

## Description

### Background
Characters (people, mascots, etc.) need visual consistency across scenes. The character library stores character details including name, description, reference images, and optional LoRA identifiers. These characters can be added to project casts and their details injected into image generation prompts.

### Scope
**In scope:**
- Character CRUD API endpoints
- Character storage with name, description, reference images
- Image upload and local storage
- LoRA identifier field for style consistency
- Multiple reference images per character

**Out of scope:**
- Character generation from description (AI)
- Character training/fine-tuning
- Sharing characters between users
- Character marketplace

### User Flow
1. User opens character library panel
2. User clicks "Create Character"
3. User enters name and description
4. User uploads reference images (1-5 images)
5. Optionally enters LoRA identifier
6. System saves character to library
7. Character appears in library grid
8. User can edit or delete characters later

---

## Acceptance Criteria

- [ ] `GET /api/v1/characters` returns all characters
- [ ] `POST /api/v1/characters` creates character with name (required)
- [ ] Character can include: description, referenceImages (array), styleLora
- [ ] `GET /api/v1/characters/:id` returns single character
- [ ] `PUT /api/v1/characters/:id` updates character fields
- [ ] `DELETE /api/v1/characters/:id` removes character and images
- [ ] `POST /api/v1/characters/:id/images` uploads reference image
- [ ] Images stored in `data/characters/{characterId}/ref_{n}.{ext}`
- [ ] Supports PNG, JPG, WebP image formats
- [ ] Maximum 5 reference images per character
- [ ] Maximum image size: 5MB
- [ ] `DELETE /api/v1/characters/:id/images/:index` removes specific image
- [ ] Character list sorted by name alphabetically
- [ ] Delete cascade removes all character images

---

## Technical Notes

### Components
- **API Route:** `src/backend/api/characters.ts`
- **File Utils:** `src/backend/services/fileStorage.ts`

### API Specifications

#### List Characters
```
GET /api/v1/characters

Response (200):
{
  "characters": [
    {
      "id": "char_abc123",
      "name": "Dr. Sarah Chen",
      "description": "A distinguished scientist in her 50s...",
      "referenceImages": [
        "/api/v1/characters/char_abc123/images/0",
        "/api/v1/characters/char_abc123/images/1"
      ],
      "styleLora": "realistic_portrait_v2",
      "createdAt": "2026-01-17T10:00:00Z"
    }
  ]
}
```

#### Create Character
```
POST /api/v1/characters
Content-Type: application/json

Request:
{
  "name": "Dr. Sarah Chen",
  "description": "A distinguished scientist in her 50s with silver-streaked black hair...",
  "styleLora": "realistic_portrait_v2"
}

Response (201):
{
  "id": "char_abc123",
  "name": "Dr. Sarah Chen",
  "description": "A distinguished scientist...",
  "referenceImages": [],
  "styleLora": "realistic_portrait_v2",
  "createdAt": "2026-01-17T10:00:00Z"
}
```

#### Upload Reference Image
```
POST /api/v1/characters/:id/images
Content-Type: multipart/form-data

Form Data:
- image: [binary file]

Response (201):
{
  "index": 0,
  "url": "/api/v1/characters/char_abc123/images/0"
}
```

#### Get Image
```
GET /api/v1/characters/:id/images/:index

Response: Binary image data with appropriate Content-Type
```

#### Update Character
```
PUT /api/v1/characters/:id
Content-Type: application/json

Request:
{
  "name": "Dr. Sarah Chen, PhD",
  "description": "Updated description..."
}

Response (200):
{
  "id": "char_abc123",
  "name": "Dr. Sarah Chen, PhD",
  ...
}
```

#### Delete Character
```
DELETE /api/v1/characters/:id

Response (204): No content
```

### Zod Schemas

```typescript
export const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  styleLora: z.string().max(100).optional(),
});

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  styleLora: z.string().max(100).optional(),
});
```

### File Storage

```typescript
// src/backend/services/fileStorage.ts
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';

const CHARACTERS_DIR = join(process.cwd(), 'data', 'characters');

export async function saveCharacterImage(
  characterId: string,
  imageBuffer: Buffer,
  extension: string
): Promise<number> {
  const charDir = join(CHARACTERS_DIR, characterId);
  await mkdir(charDir, { recursive: true });

  // Find next available index
  const files = await readdir(charDir);
  const indices = files
    .filter(f => f.startsWith('ref_'))
    .map(f => parseInt(f.split('_')[1]))
    .filter(n => !isNaN(n));
  const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;

  const filename = `ref_${nextIndex}.${extension}`;
  await writeFile(join(charDir, filename), imageBuffer);

  return nextIndex;
}

export async function getCharacterImage(
  characterId: string,
  index: number
): Promise<{ buffer: Buffer; extension: string } | null> {
  const charDir = join(CHARACTERS_DIR, characterId);
  const files = await readdir(charDir);
  const file = files.find(f => f.startsWith(`ref_${index}.`));

  if (!file) return null;

  const buffer = await readFile(join(charDir, file));
  const extension = file.split('.').pop() || 'png';

  return { buffer, extension };
}

export async function deleteCharacterImages(characterId: string): Promise<void> {
  const charDir = join(CHARACTERS_DIR, characterId);
  await rm(charDir, { recursive: true, force: true });
}
```

### Image Upload Handling

```typescript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/:id/images', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const character = await getCharacter(id);

  if (!character) return res.status(404).json({ error: 'Character not found' });
  if (character.referenceImages.length >= 5) {
    return res.status(400).json({ error: 'Maximum 5 images allowed' });
  }

  const extension = req.file.mimetype.split('/')[1];
  const index = await saveCharacterImage(id, req.file.buffer, extension);

  // Update character's referenceImages array
  const images = [...character.referenceImages, `/api/v1/characters/${id}/images/${index}`];
  await updateCharacter(id, { referenceImages: images });

  res.status(201).json({ index, url: images[images.length - 1] });
});
```

### Security Considerations
- Validate image file type server-side (not just extension)
- Prevent path traversal in characterId
- Limit upload size to prevent DoS
- Sanitize filename/extension

---

## Dependencies

**Prerequisite Stories:**
- STORY-001: Project Setup & Database Schema (database tables)

**Blocked Stories:**
- STORY-012: Character Library UI (displays characters)
- STORY-013: Project Cast Management (uses character library)
- STORY-018: Image Generation Job (injects character references)

**External Dependencies:**
- `multer` npm package for file uploads

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Create character with all fields
  - [ ] Validation error handling
  - [ ] Image upload and storage
  - [ ] Image retrieval
  - [ ] Delete character and images
- [ ] Integration tests passing
  - [ ] Full CRUD flow
  - [ ] Image upload/download cycle
  - [ ] 404 handling
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] API endpoint documentation
  - [ ] Image format requirements
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with image uploads

---

## Story Points Breakdown

- **CRUD endpoints:** 1.5 points
- **Image upload/storage:** 1 point
- **Image serving & deletion:** 0.5 points
- **Total:** 3 points

**Rationale:** Standard CRUD plus file handling. Multer simplifies upload handling.

---

## Additional Notes

Future enhancements:
- Image cropping/resizing on upload
- Thumbnail generation for faster loading
- Image reordering
- Character tags/categories

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
