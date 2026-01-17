
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useParams, useNavigate } from '@tanstack/react-router';
import * as Icons from './Icons';
import ThemeSelector from './ThemeSelector';
import { ViewState, User, Project } from '../types';
import ProjectDropdown from './Sidebar/ProjectDropdown';

const LAST_PROJECT_KEY = 'studioai_last_project_id';

interface LayoutProject {
  id: string;
  name: string;
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  projects: LayoutProject[];
  onUpdateProject: (id: string, updates: { name: string }) => void;
  onCreateProject: () => string | Promise<string>; // Returns new project ID (sync or async)
}

const CREATION_STEPS = [
  { id: 'script', label: 'Script & Audio' },
  { id: 'cast', label: 'Cast' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'video', label: 'Video Editor' },
];

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  onLogout,
  projects,
  onUpdateProject,
  onCreateProject
}) => {
  // Get current route info
  const location = useLocation();
  const params = useParams({ strict: false }) as { projectId?: string };
  const navigate = useNavigate();

  // Get activeProjectId from URL params first, then fall back to localStorage
  const getStoredProjectId = (): string => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(LAST_PROJECT_KEY);
    // Verify the stored project still exists
    if (stored && projects.some(p => p.id === stored)) {
      return stored;
    }
    return '';
  };

  const activeProjectId = params.projectId || getStoredProjectId();
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Header inline editing state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerEditName, setHeaderEditName] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Focus input when header editing starts
  useEffect(() => {
    if (isEditingHeader && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [isEditingHeader]);

  const startHeaderEdit = () => {
    if (activeProject) {
      setHeaderEditName(activeProject.name);
      setIsEditingHeader(true);
    }
  };

  const saveHeaderEdit = () => {
    if (activeProject && headerEditName.trim()) {
      onUpdateProject(activeProject.id, { name: headerEditName.trim() });
    }
    setIsEditingHeader(false);
  };

  const cancelHeaderEdit = () => {
    setIsEditingHeader(false);
    if (activeProject) {
      setHeaderEditName(activeProject.name);
    }
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveHeaderEdit();
    } else if (e.key === 'Escape') {
      cancelHeaderEdit();
    }
  };

  // Persist selected project to localStorage
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(LAST_PROJECT_KEY, activeProjectId);
    }
  }, [activeProjectId]);

  // Derive currentView from route path
  const getCurrentView = (): ViewState => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path === '/characters') return 'characters';
    if (path.includes('/script')) return 'script';
    if (path.includes('/storyboard')) return 'storyboard';
    if (path.includes('/video')) return 'video';
    return 'dashboard';
  };

  const currentView = getCurrentView();

  // Project selection handler
  const handleSelectProject = (projectId: string) => {
    navigate({
      to: '/project/$projectId/script',
      params: { projectId }
    });
  };

  // Logic for Dynamic Button and Breadcrumbs
  const currentStepIndex = CREATION_STEPS.findIndex(step => step.id === currentView);
  const isInCreationFlow = currentStepIndex !== -1;
  const nextStep = isInCreationFlow && currentStepIndex < CREATION_STEPS.length - 1
    ? CREATION_STEPS[currentStepIndex + 1]
    : null;

  const prevStep = isInCreationFlow && currentStepIndex > 0
    ? CREATION_STEPS[currentStepIndex - 1]
    : null;

  const handleBack = () => {
    if (prevStep && activeProjectId) {
      navigate({
        to: `/project/$projectId/${prevStep.id}` as any,
        params: { projectId: activeProjectId }
      });
    } else {
      navigate({ to: '/' });
    }
  };

  const handleDynamicButtonClick = () => {
    if (currentView === 'dashboard') {
      // Create new project and navigate
      const newProjectId = onCreateProject();
      navigate({
        to: '/project/$projectId/script',
        params: { projectId: newProjectId }
      });
    } else if (nextStep && activeProjectId) {
      navigate({
        to: `/project/$projectId/${nextStep.id}` as any,
        params: { projectId: activeProjectId }
      });
    } else if (currentView === 'video') {
      navigate({ to: '/' });
    }
  };

  const getDynamicButtonLabel = () => {
    if (currentView === 'dashboard') return { text: 'Quick Create', icon: Icons.Plus };
    if (nextStep) return { text: `Next: ${nextStep.label}`, icon: Icons.ChevronRight };
    if (currentView === 'video') return { text: 'Finish Project', icon: Icons.CheckCircle };
    return { text: 'Quick Create', icon: Icons.Plus };
  };

  const buttonConfig = getDynamicButtonLabel();

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark font-display text-white selection:bg-primary/30">
      {/* Sidebar Navigation */}
      <aside className="w-16 lg:w-64 flex-shrink-0 border-r border-border-color bg-background-dark flex flex-col transition-all duration-300">
        <div className="p-4 lg:p-6 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 justify-center lg:justify-start">
            <div className="bg-primary size-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <Icons.Film className="text-white" size={20} />
            </div>
            <div className="flex-col hidden lg:flex">
              <h1 className="text-white text-base font-bold leading-none">Studio AI</h1>
              <p className="text-text-muted text-[10px] font-normal tracking-wide mt-1">CREATOR PRO</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2 flex-grow">
            {/* Global Navigation */}
            {/* Dashboard Link */}
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl cursor-pointer transition-all group ${currentView === 'dashboard' ? 'bg-primary/20 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
                }`}
            >
              <Icons.LayoutDashboard size={20} className={currentView === 'dashboard' ? 'text-primary' : ''} />
              <p className="text-sm font-medium hidden lg:block">Dashboard</p>
              {currentView === 'dashboard' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary hidden lg:block"></div>}
            </Link>

            {/* Characters Link */}
            <Link
              to="/characters"
              className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl cursor-pointer transition-all group ${currentView === 'characters' ? 'bg-primary/20 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
                }`}
            >
              <Icons.User size={20} className={currentView === 'characters' ? 'text-primary' : ''} />
              <p className="text-sm font-medium hidden lg:block">Characters</p>
              {currentView === 'characters' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary hidden lg:block"></div>}
            </Link>

            {/* Project Scope Separator & Dropdown */}
            <div className="my-3 pt-3 border-t border-white/10">
              <label className="text-[9px] text-text-muted font-bold uppercase tracking-wider px-4 mb-2 block hidden lg:block">
                Project
              </label>
              <ProjectDropdown
                projects={projects}
                activeProjectId={activeProjectId || null}
                onSelectProject={handleSelectProject}
                onCreateProject={onCreateProject}
                onUpdateProject={onUpdateProject}
                isCollapsed={false}
              />
            </div>

            {/* Project-specific Navigation */}
            <div className="pt-2 border-t border-white/5">
              {[
                { id: 'script', icon: Icons.Type, label: 'Script & Audio', path: 'script' },
                { id: 'cast', icon: Icons.Users, label: 'Cast & Characters', path: 'cast' },
                { id: 'storyboard', icon: Icons.Grid, label: 'Storyboard', path: 'storyboard' },
                { id: 'video', icon: Icons.Film, label: 'Video Editor', path: 'video' },
              ].map((item) => {
                const isActive = currentView === item.id;
                // Only enable if we have an active project
                const canNavigate = !!activeProjectId;

                if (!canNavigate) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl text-text-muted/30 cursor-not-allowed relative group/disabled"
                      title="Select a project first"
                    >
                      <item.icon size={20} />
                      <p className="text-sm font-medium hidden lg:block">{item.label}</p>
                      {/* Tooltip for disabled state */}
                      <div className="absolute left-full ml-2 px-2 py-1 bg-background-dark border border-white/10 rounded text-xs text-text-muted whitespace-nowrap opacity-0 group-hover/disabled:opacity-100 transition-opacity pointer-events-none hidden lg:block z-50">
                        Select a project first
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    to={`/project/$projectId/${item.path}` as any}
                    params={{ projectId: activeProjectId }}
                    className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl cursor-pointer transition-all group ${isActive ? 'bg-primary/20 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <item.icon size={20} className={isActive ? 'text-primary' : ''} />
                    <p className="text-sm font-medium hidden lg:block">{item.label}</p>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary hidden lg:block"></div>}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Credits */}
          <div className="mt-auto pt-4 border-t border-white/5 hidden lg:block">
            <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
              <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider font-bold flex justify-between">
                Rendering Credits <span>120m</span>
              </p>
              <div className="w-full bg-surface-0 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary-hover h-full w-2/3"></div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-text-muted hover:bg-error/10 hover:text-error cursor-pointer transition-all w-full"
            >
              <Icons.LogOut size={20} />
              <p className="text-sm font-medium">Sign Out</p>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between border-b border-border-color bg-background-dark/80 backdrop-blur-md px-8 shrink-0 z-20 relative">

          {/* Left Section: Back Button & Search/Project */}
          <div className="flex items-center gap-6 z-10">
            {isInCreationFlow && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center p-2 -ml-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all"
                title="Go Back"
              >
                <Icons.ChevronLeft size={20} />
              </button>
            )}

            {isInCreationFlow && activeProject ? (
              /* Project Context Display with Inline Edit */
              <div className="hidden md:flex flex-col justify-center border-l border-white/10 pl-6 h-8 group">
                <label className="text-[9px] text-text-muted font-bold uppercase tracking-wider leading-none mb-1">Active Project</label>
                {isEditingHeader ? (
                  <input
                    ref={headerInputRef}
                    type="text"
                    value={headerEditName}
                    onChange={(e) => setHeaderEditName(e.target.value)}
                    onKeyDown={handleHeaderKeyDown}
                    onBlur={saveHeaderEdit}
                    className="bg-transparent border-b border-primary text-sm font-bold text-white focus:outline-none w-[200px]"
                    aria-label="Project name"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p
                      className="text-sm font-bold text-white truncate max-w-[200px] cursor-pointer hover:text-primary transition-colors"
                      title={`${activeProject.name} (click to edit)`}
                      onClick={startHeaderEdit}
                    >
                      {activeProject.name}
                    </p>
                    <button
                      onClick={startHeaderEdit}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-primary transition-all p-0.5"
                      title="Rename Project"
                      aria-label="Rename project"
                    >
                      <Icons.Edit3 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ) : !isInCreationFlow && (
              /* Dashboard Search */
              <div className="relative group w-64 hidden md:block">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-white transition-colors" size={18} />
                <input
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:ring-1 focus:ring-primary focus:bg-surface-3 transition-all"
                  placeholder="Search..."
                  type="text"
                />
              </div>
            )}
          </div>

          {/* Center Section: Breadcrumbs */}
          {isInCreationFlow && activeProjectId && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
              {CREATION_STEPS.map((step, idx) => {
                const isActive = step.id === currentView;
                const isPast = idx < currentStepIndex;

                return (
                  <React.Fragment key={step.id}>
                    <Link
                      to={`/project/$projectId/${step.id}` as any}
                      params={{ projectId: activeProjectId }}
                      className={`flex items-center gap-2 text-xs font-bold transition-colors ${isActive ? 'text-white' : isPast ? 'text-primary hover:text-primary/80' : 'text-text-muted'
                        }`}
                    >
                      {isActive && <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>}
                      {step.label}
                    </Link>
                    {idx < CREATION_STEPS.length - 1 && (
                      <Icons.ChevronRight size={12} className="text-white/20" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Right Section: Actions */}
          <div className="flex items-center gap-6 ml-auto z-10">
            <button
              onClick={handleDynamicButtonClick}
              className="hidden md:flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-glow-sm"
            >
              {buttonConfig.icon && <buttonConfig.icon size={16} />}
              {buttonConfig.text}
            </button>
            <div className="h-6 w-px bg-white/10 hidden md:block"></div>
            <ThemeSelector />
            <button className="relative p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors">
              <Icons.Bell size={20} />
              <span className="absolute top-2 right-2 size-2 bg-primary rounded-full border border-background-dark"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-[10px] text-text-muted">{user.email}</p>
              </div>
              <div className="size-9 rounded-full border-2 border-primary/50 overflow-hidden cursor-pointer">
                <img
                  className="w-full h-full object-cover"
                  src={user.avatar}
                  alt="User"
                />
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
};

export default Layout;
