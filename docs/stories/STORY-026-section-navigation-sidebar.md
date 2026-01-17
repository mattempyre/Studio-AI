# STORY-026: Section Navigation Sidebar

**Epic:** Storyboard UI (EPIC-06)
**Priority:** Must Have
**Story Points:** 2
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **section navigation**
So that **I can quickly jump to specific parts of my video**

---

## Description

### Background
Long videos can have dozens of sections. The section navigation sidebar provides quick access to any section, showing section titles and progress indicators. This enables efficient navigation without scrolling through the entire storyboard.

### Scope
**In scope:**
- Left sidebar with section list
- Section titles with scene counts
- Click to scroll to section
- Progress indicator per section
- Collapsible on small screens

**Out of scope:**
- Drag-and-drop section reordering
- Section editing (add/remove/rename)
- Nested sections
- Section thumbnails

### User Flow
1. User opens storyboard
2. Left sidebar shows all sections
3. Each section shows title and scene count
4. Progress indicator shows completion status
5. User clicks section to scroll to it
6. Main view scrolls to selected section
7. On mobile, user can collapse sidebar

---

## Acceptance Criteria

- [ ] Left sidebar displays all sections
- [ ] Each section shows: title, scene count
- [ ] Progress bar shows % of scenes with all assets
- [ ] Click section scrolls main view to that section
- [ ] Current section highlighted during scroll
- [ ] Sticky sidebar (doesn't scroll with content)
- [ ] Collapse/expand button on mobile
- [ ] Collapsed state shows only icons
- [ ] Sidebar width: 200px expanded, 48px collapsed
- [ ] Empty state if no sections

---

## Technical Notes

### Components
- **Sidebar:** `src/components/Storyboard/SectionSidebar.tsx`
- **Item:** `src/components/Storyboard/SectionNavItem.tsx`

### Section Sidebar

```tsx
// SectionSidebar.tsx
function SectionSidebar({ sections, currentSectionId, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate progress per section
  const sectionProgress = useMemo(() => {
    return sections.map(section => {
      const total = section.sentences?.length || 0;
      const complete = section.sentences?.filter(s =>
        s.audioFile && s.imageFile && s.videoFile
      ).length || 0;
      return { id: section.id, progress: total > 0 ? (complete / total) * 100 : 0 };
    });
  }, [sections]);

  return (
    <div className={`section-sidebar bg-gray-50 border-r flex flex-col
      ${isCollapsed ? 'w-12' : 'w-52'} transition-all duration-200`}
    >
      {/* Header */}
      <div className="p-2 border-b flex items-center justify-between">
        {!isCollapsed && <span className="font-semibold text-sm">Sections</span>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-auto py-2">
        {sections.map((section, index) => {
          const progress = sectionProgress.find(p => p.id === section.id)?.progress || 0;

          return (
            <SectionNavItem
              key={section.id}
              section={section}
              index={index}
              progress={progress}
              isActive={section.id === currentSectionId}
              isCollapsed={isCollapsed}
              onClick={() => onNavigate(section.id)}
            />
          );
        })}
      </div>

      {/* Summary */}
      {!isCollapsed && (
        <div className="p-3 border-t text-xs text-gray-500">
          {sections.length} sections
        </div>
      )}
    </div>
  );
}
```

### Section Nav Item

```tsx
// SectionNavItem.tsx
function SectionNavItem({
  section,
  index,
  progress,
  isActive,
  isCollapsed,
  onClick,
}: NavItemProps) {
  const sceneCount = section.sentences?.length || 0;

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={`w-full p-2 flex justify-center ${
          isActive ? 'bg-blue-100' : 'hover:bg-gray-200'
        }`}
        title={section.title}
      >
        <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
          {index + 1}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 text-left ${
        isActive ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-100'
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium truncate">{section.title}</span>
        <span className="text-xs text-gray-400">{sceneCount}</span>
      </div>

      {/* Progress bar */}
      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}
```

### Scroll to Section

```tsx
// useScrollToSection.ts
function useScrollToSection() {
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return scrollToSection;
}

// In StoryboardTable/Grid
function SectionHeader({ section }: { section: Section }) {
  return (
    <div id={`section-${section.id}`} className="section-header">
      {/* ... */}
    </div>
  );
}
```

### Track Current Section on Scroll

```tsx
// useCurrentSection.ts
function useCurrentSection(sections: Section[]) {
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id.replace('section-', '');
            setCurrentSectionId(sectionId);
            break;
          }
        }
      },
      { threshold: 0.5 }
    );

    sections.forEach(section => {
      const element = document.getElementById(`section-${section.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  return currentSectionId;
}
```

### Integration with Storyboard

```tsx
// Storyboard.tsx
function Storyboard({ projectId }) {
  const { data } = useStoryboard(projectId);
  const scrollToSection = useScrollToSection();
  const currentSectionId = useCurrentSection(data?.sections || []);

  return (
    <div className="flex h-full">
      {/* Section Sidebar */}
      <SectionSidebar
        sections={data?.sections || []}
        currentSectionId={currentSectionId}
        onNavigate={scrollToSection}
      />

      {/* Main Content */}
      <div className="flex-1">
        {/* Table or Grid */}
      </div>

      {/* Inspector */}
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-023: Storyboard Table View

**Blocked Stories:**
- None

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Progress calculation
  - [ ] Collapse toggle
  - [ ] Navigation
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive collapse tested
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with long project

---

## Story Points Breakdown

- **Sidebar structure:** 0.5 points
- **Section items with progress:** 0.5 points
- **Scroll navigation:** 0.5 points
- **Collapse functionality:** 0.5 points
- **Total:** 2 points

**Rationale:** Straightforward navigation component. Intersection observer adds slight complexity for current section tracking.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
