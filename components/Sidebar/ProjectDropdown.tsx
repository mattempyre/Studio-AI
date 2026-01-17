import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as Icons from '../Icons';

interface LayoutProject {
  id: string;
  name: string;
}

interface ProjectDropdownProps {
  projects: LayoutProject[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => string | Promise<string>;
  onUpdateProject: (id: string, updates: { name: string }) => void;
  isCollapsed?: boolean;
}

const MAX_NAME_LENGTH = 20;

const truncateName = (name: string): string => {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH) + '...';
};

// Scrolling text component for truncated names
interface ScrollingTextProps {
  text: string;
  maxLength: number;
  className?: string;
}

const ScrollingText: React.FC<ScrollingTextProps> = ({ text, maxLength, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    if (isHovered && containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      if (textWidth > containerWidth) {
        setShouldScroll(true);
        setScrollDistance(textWidth - containerWidth + 16); // 16px extra padding
      } else {
        setShouldScroll(false);
      }
    }
  }, [isHovered, text]);

  const displayText = isHovered ? text : truncateName(text);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={text}
    >
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap transition-transform"
        style={{
          transform: isHovered && shouldScroll ? `translateX(-${scrollDistance}px)` : 'translateX(0)',
          transition: isHovered && shouldScroll
            ? `transform ${Math.max(scrollDistance * 20, 1500)}ms linear`
            : 'transform 0.2s ease-out',
        }}
      >
        {displayText}
      </span>
    </div>
  );
};

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  isCollapsed = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Sort projects by updatedAt (assuming most recent first)
  // Since we don't have updatedAt in LayoutProject, we'll use the order they come in
  const sortedProjects = [...projects];

  // Click outside to close dropdown and save edit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (isEditing) {
          saveEdit();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editName]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeProject) {
      setEditName(activeProject.name);
      setIsEditing(true);
    }
  };

  const saveEdit = () => {
    if (activeProject && editName.trim()) {
      onUpdateProject(activeProject.id, { name: editName.trim() });
    } else if (activeProject) {
      // Revert to original name if empty
      setEditName(activeProject.name);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (activeProject) {
      setEditName(activeProject.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleSelectProject = (projectId: string) => {
    setIsOpen(false);
    onSelectProject(projectId);
  };

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const newProjectId = await Promise.resolve(onCreateProject());
    navigate({
      to: '/project/$projectId/script',
      params: { projectId: newProjectId }
    });
  };

  const toggleDropdown = () => {
    if (!isEditing) {
      setIsOpen(!isOpen);
    }
  };

  // Collapsed sidebar view - icon only
  if (isCollapsed) {
    return (
      <div ref={dropdownRef} className="relative px-3">
        <button
          onClick={toggleDropdown}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 transition-all relative"
          aria-label="Select active project"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={activeProject?.name || 'Select a project'}
        >
          <Icons.FolderOpen size={20} className="text-text-muted" />
          {activeProject && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
          )}
        </button>

        {isOpen && (
          <ul
            role="listbox"
            aria-label="Available projects"
            className="absolute left-0 top-12 w-56 bg-background-dark border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
          >
            {sortedProjects.length === 0 ? (
              <li className="px-4 py-3 text-sm text-text-muted text-center">
                No projects yet
              </li>
            ) : (
              sortedProjects.map(project => (
                <li
                  key={project.id}
                  role="option"
                  aria-selected={project.id === activeProjectId}
                  onClick={() => handleSelectProject(project.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  {project.id === activeProjectId && (
                    <Icons.Check size={14} className="text-primary shrink-0" />
                  )}
                  <span className={project.id === activeProjectId ? '' : 'ml-5'}>
                    {project.name}
                  </span>
                </li>
              ))
            )}
            <li
              onClick={handleCreateProject}
              className="flex items-center gap-2 px-4 py-2 text-sm text-primary font-medium border-t border-white/10 hover:bg-primary/10 cursor-pointer transition-colors"
            >
              <Icons.Plus size={14} />
              Create New Project
            </li>
          </ul>
        )}
      </div>
    );
  }

  // Expanded sidebar view
  return (
    <div ref={dropdownRef} className="relative px-2">
      {/* Dropdown Trigger */}
      <div
        className="flex items-center justify-between w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all group"
        onClick={toggleDropdown}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-b border-primary text-sm font-medium text-white focus:outline-none w-full mr-2"
            aria-label="Project name"
          />
        ) : (
          <>
            {activeProject ? (
              <ScrollingText
                text={activeProject.name}
                maxLength={MAX_NAME_LENGTH}
                className="text-sm font-medium text-white flex-1 min-w-0"
              />
            ) : (
              <span className="text-sm font-medium text-white truncate">
                Select a project...
              </span>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {activeProject && (
                <button
                  onClick={startEditing}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-primary transition-all p-0.5"
                  title="Rename Project"
                  aria-label="Rename project"
                >
                  <Icons.Edit3 size={12} />
                </button>
              )}
              <Icons.ChevronDown
                size={14}
                className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && !isEditing && (
        <ul
          id="project-dropdown-menu"
          role="listbox"
          aria-label="Available projects"
          className="absolute left-2 right-2 mt-1 bg-background-dark border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
        >
          {sortedProjects.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-muted text-center">
              No projects yet. Create your first project!
            </li>
          ) : (
            sortedProjects.map(project => (
              <li
                key={project.id}
                role="option"
                aria-selected={project.id === activeProjectId}
                onClick={() => handleSelectProject(project.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer transition-colors"
              >
                {project.id === activeProjectId ? (
                  <Icons.Check size={14} className="text-primary shrink-0" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <ScrollingText
                  text={project.name}
                  maxLength={MAX_NAME_LENGTH}
                  className="flex-1 min-w-0"
                />
              </li>
            ))
          )}
          <li
            onClick={handleCreateProject}
            className="flex items-center gap-2 px-4 py-2 text-sm text-primary font-medium border-t border-white/10 hover:bg-primary/10 cursor-pointer transition-colors"
          >
            <Icons.Plus size={14} />
            Create New Project
          </li>
        </ul>
      )}
    </div>
  );
};

export default ProjectDropdown;
