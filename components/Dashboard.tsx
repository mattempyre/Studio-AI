import React from 'react';
import { MOCK_TEMPLATES } from '../constants';
import * as Icons from './Icons';
import { ViewState, Project, User } from '../types';

interface DashboardProps {
  user: User;
  projects: Project[];
  onNavigate: (view: ViewState) => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, projects, onNavigate, onSelectProject, onCreateProject }) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 font-display">
      {/* Welcome Header */}
      <div className="mb-10">
        <h2 className="text-4xl font-bold text-white tracking-tight mb-2">Welcome back, {user.name}</h2>
        <p className="text-text-muted text-lg">Ready to create your next viral YouTube video?</p>
      </div>

      {/* Create Actions */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Icons.Plus className="text-primary" />
          <h3 className="text-xl font-bold text-white">Create New Project</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            onClick={onCreateProject}
            className="group bg-card-bg/50 border border-border-color hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all duration-300"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 text-primary">
                  <Icons.Type size={24} />
                </div>
                <h4 className="text-xl font-bold text-white">Script to Video</h4>
                <p className="text-text-muted mt-2">Write your own script or paste a URL. We'll handle the rest.</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm group-hover:translate-x-2 transition-transform">
                Start Writing <Icons.ChevronRight size={16} />
              </div>
            </div>
          </div>

          <div 
            onClick={onCreateProject}
            className="group relative overflow-hidden bg-primary p-[1px] rounded-xl cursor-pointer hover:shadow-[0_0_20px_rgba(234,40,49,0.3)] transition-all duration-300"
          >
            <div className="bg-background-dark h-full w-full rounded-xl p-6 flex flex-col justify-between relative z-10">
              <div>
                <div className="size-12 rounded-lg bg-primary flex items-center justify-center mb-4 text-white">
                  <Icons.Wand2 size={24} />
                </div>
                <h4 className="text-xl font-bold text-white">AI Idea to Video</h4>
                <p className="text-text-muted mt-2">Just enter a topic. Gemini will generate the script, scenes, and video.</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm group-hover:translate-x-2 transition-transform">
                Generate Magic <Icons.Wand2 size={14} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Projects */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Icons.FolderOpen className="text-primary" size={20} />
            Recent Projects
          </h3>
          <button className="text-text-muted text-sm font-bold hover:text-white transition-colors">View All</button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-white/5">
            <p className="text-text-muted">No projects yet. Start creating!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <div 
                key={proj.id} 
                onClick={() => onSelectProject(proj.id)}
                className="group cursor-pointer bg-card-bg border border-border-color hover:border-primary/50 rounded-xl overflow-hidden transition-all duration-300"
              >
                <div className="h-40 bg-black relative">
                  {proj.thumbnail ? (
                    <img src={proj.thumbnail} alt={proj.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                       <Icons.Film className="text-white/20" size={40} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      proj.status === 'completed' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                      proj.status === 'rendering' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                      'bg-white/10 text-text-muted border border-white/20'
                    }`}>
                      {proj.status}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-white truncate">{proj.name}</h4>
                  <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
                    <span>{proj.type}</span>
                    <span className="flex items-center gap-1"><Icons.Clock size={12}/> {proj.lastEdited}</span>
                  </div>
                  <div className="mt-4 w-full bg-black h-1 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-500" style={{ width: `${proj.progress}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Templates */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Icons.LayoutDashboard className="text-primary" size={20} />
            Start from Template
          </h3>
          <button className="text-primary text-sm font-bold hover:underline">View all templates</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_TEMPLATES.map((template) => (
            <div key={template.id} className="group cursor-pointer flex flex-col gap-3">
              <div className="aspect-video relative rounded-lg overflow-hidden bg-card-bg border border-border-color group-hover:border-primary/50 transition-all">
                <img 
                  src={template.thumbnail} 
                  alt={template.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background-dark/90 to-transparent" />
                
                {template.isPremium && (
                  <div className="absolute top-2 right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    PREMIUM
                  </div>
                )}
                
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white">
                  <Icons.Clock size={10} /> {template.duration}
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white text-background-dark font-bold px-4 py-2 rounded-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <Icons.PlayCircle size={16} /> Preview
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-white text-sm font-bold truncate">{template.title}</p>
                <p className="text-text-muted text-xs truncate">{template.category}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;