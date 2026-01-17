
import React, { useState, useEffect } from 'react';
import * as Icons from './Icons';
import { ViewState, User, Project } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  user: User;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onUpdateProject: (project: Project) => void;
  onCreateProject: () => void;
}

const CREATION_STEPS = [
  { id: 'script', label: 'Script & Audio' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'video', label: 'Video Editor' },
];

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  user, 
  onNavigate, 
  onLogout,
  projects,
  activeProjectId,
  onSelectProject,
  onUpdateProject,
  onCreateProject
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (activeProject) {
      setTempTitle(activeProject.name);
    }
  }, [activeProject]);

  const startEditing = () => {
    if (activeProject) {
      setTempTitle(activeProject.name);
      setIsEditingTitle(true);
    }
  };

  const saveTitle = () => {
    if (activeProject && tempTitle.trim()) {
      onUpdateProject({ ...activeProject, name: tempTitle });
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTempTitle(activeProject?.name || '');
    }
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
      if (prevStep) {
          onNavigate(prevStep.id as ViewState);
      } else {
          onNavigate('dashboard');
      }
  };

  const handleDynamicButtonClick = () => {
    if (currentView === 'dashboard') {
      onNavigate('script');
    } else if (nextStep) {
      onNavigate(nextStep.id as ViewState);
    } else if (currentView === 'video') {
      onNavigate('dashboard');
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
            {[
              { id: 'dashboard', icon: Icons.LayoutDashboard, label: 'Dashboard' },
              { id: 'characters', icon: Icons.User, label: 'Characters' },
              { id: 'script', icon: Icons.Type, label: 'Script & Audio' },
              { id: 'storyboard', icon: Icons.Grid, label: 'Storyboard' },
              { id: 'video', icon: Icons.Film, label: 'Video Editor' },
            ].map((item) => (
              <div 
                key={item.id}
                onClick={() => onNavigate(item.id as ViewState)}
                className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl cursor-pointer transition-all group ${
                  currentView === item.id ? 'bg-primary/20 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={20} className={currentView === item.id ? 'text-primary' : ''} />
                <p className="text-sm font-medium hidden lg:block">{item.label}</p>
                {currentView === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary hidden lg:block"></div>}
              </div>
            ))}
          </nav>

          {/* Credits */}
          <div className="mt-auto pt-4 border-t border-white/5 hidden lg:block">
            <div className="bg-[#1e1933] p-4 rounded-xl border border-white/5">
              <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider font-bold flex justify-between">
                Rendering Credits <span>120m</span>
              </p>
              <div className="w-full bg-black h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-orange-500 h-full w-2/3"></div>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-text-muted hover:bg-red-500/10 hover:text-red-500 cursor-pointer transition-all w-full"
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

            {isInCreationFlow ? (
                /* Project Context & Rename */
                <div className="hidden md:flex flex-col justify-center border-l border-white/10 pl-6 h-8">
                    <label className="text-[9px] text-text-muted font-bold uppercase tracking-wider leading-none mb-1">Active Project</label>
                    <div className="flex items-center gap-2 group/edit">
                        {isEditingTitle ? (
                            <input 
                            autoFocus
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent border-b border-primary text-sm font-bold text-white focus:outline-none w-48"
                            />
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <select 
                                        value={activeProjectId}
                                        onChange={(e) => {
                                            if (e.target.value === 'new_project_action') {
                                                onCreateProject();
                                            } else {
                                                onSelectProject(e.target.value);
                                            }
                                        }}
                                        className="appearance-none bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-5 truncate max-w-[200px]"
                                    >
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id} className="bg-background-dark text-white">
                                                {p.name}
                                            </option>
                                        ))}
                                        <option value="new_project_action" className="bg-background-dark text-primary font-bold">
                                            + Create New Project
                                        </option>
                                    </select>
                                    <Icons.ChevronDown size={12} className="text-text-muted absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                <button 
                                    onClick={startEditing} 
                                    className="opacity-0 group-hover/edit:opacity-100 text-text-muted hover:text-primary transition-all"
                                    title="Rename Project"
                                >
                                    <Icons.Edit3 size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Dashboard Search */
                <div className="relative group w-64 hidden md:block">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-white transition-colors" size={18} />
                    <input 
                      className="w-full bg-[#1e1933] border border-transparent rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:ring-1 focus:ring-primary focus:bg-[#1e1933] transition-all" 
                      placeholder="Search..." 
                      type="text" 
                    />
                </div>
            )}
          </div>

          {/* Center Section: Breadcrumbs */}
          {isInCreationFlow && (
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                 {CREATION_STEPS.map((step, idx) => {
                   const isActive = step.id === currentView;
                   const isPast = idx < currentStepIndex;
                   
                   return (
                     <React.Fragment key={step.id}>
                       <button 
                         onClick={() => onNavigate(step.id as ViewState)}
                         className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                           isActive ? 'text-white' : isPast ? 'text-primary hover:text-primary/80' : 'text-text-muted'
                         }`}
                       >
                         {isActive && <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>}
                         {step.label}
                       </button>
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
              className="hidden md:flex items-center gap-2 bg-gradient-to-r from-primary to-red-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary/20"
            >
              {buttonConfig.icon && <buttonConfig.icon size={16} />} 
              {buttonConfig.text}
            </button>
            <div className="h-6 w-px bg-white/10 hidden md:block"></div>
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
