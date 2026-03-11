import { useState } from 'react';
import { useProjectStore, selectActiveProject } from '../../store/projectStore';
import type { Project } from '../../types/petri';
import { nanoid } from 'nanoid';

export default function Sidebar() {
  const {
    projects, activeProjectId,
    createProject, deleteProject, renameProject, setActiveProject,
    createSheet, deleteSheet, renameSheet, setActiveSheet,
    importProject,
  } = useProjectStore();
  const activeProject = useProjectStore(selectActiveProject);

  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');

  const handleCreateProject = () => {
    const name = newProjectName.trim() || `Project ${Object.keys(projects).length + 1}`;
    createProject(name);
    setNewProjectName('');
  };

  const handleExport = (project: Project) => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.petri.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const proj = JSON.parse(ev.target?.result as string) as Project;
          // Give it a new id to avoid collision
          proj.id = nanoid();
          importProject(proj);
        } catch {
          alert('Invalid Petri net JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="w-56 flex flex-col bg-slate-900 border-r border-slate-800 text-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="font-semibold text-slate-200">Projects</span>
        <button
          onClick={handleImport}
          title="Import project from JSON"
          className="text-xs text-slate-500 hover:text-slate-300 px-1"
        >
          ↑ Import
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {Object.values(projects).map(proj => (
          <div key={proj.id}>
            <div
              className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer group ${
                proj.id === activeProjectId ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
              onClick={() => setActiveProject(proj.id)}
            >
              {editingProjectId === proj.id ? (
                <input
                  autoFocus
                  className="flex-1 bg-slate-700 text-slate-100 rounded px-1 text-xs"
                  value={editingProjectName}
                  onChange={e => setEditingProjectName(e.target.value)}
                  onBlur={() => { renameProject(proj.id, editingProjectName); setEditingProjectId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { renameProject(proj.id, editingProjectName); setEditingProjectId(null); } }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 truncate text-xs">{proj.name}</span>
              )}
              <div className="hidden group-hover:flex gap-0.5">
                <button
                  onClick={e => { e.stopPropagation(); setEditingProjectId(proj.id); setEditingProjectName(proj.name); }}
                  className="text-slate-500 hover:text-slate-300 px-0.5"
                  title="Rename"
                >✎</button>
                <button
                  onClick={e => { e.stopPropagation(); handleExport(proj); }}
                  className="text-slate-500 hover:text-blue-400 px-0.5"
                  title="Export JSON"
                >↓</button>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm(`Delete "${proj.name}"?`)) deleteProject(proj.id); }}
                  className="text-slate-500 hover:text-red-400 px-0.5"
                  title="Delete"
                >✕</button>
              </div>
            </div>

            {/* Sheets for active project */}
            {proj.id === activeProjectId && activeProject && (
              <div className="ml-3 border-l border-slate-700 pl-2">
                {Object.values(activeProject.sheets).map(sheet => (
                  <div
                    key={sheet.id}
                    className={`flex items-center gap-1 py-1 px-1 cursor-pointer group rounded ${
                      sheet.id === activeProject.activeSheetId
                        ? 'text-indigo-400'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    onClick={() => setActiveSheet(sheet.id)}
                  >
                    {editingSheetId === sheet.id ? (
                      <input
                        autoFocus
                        className="flex-1 bg-slate-700 text-slate-100 rounded px-1 text-xs"
                        value={editingSheetName}
                        onChange={e => setEditingSheetName(e.target.value)}
                        onBlur={() => { renameSheet(sheet.id, editingSheetName); setEditingSheetId(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') { renameSheet(sheet.id, editingSheetName); setEditingSheetId(null); } }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 truncate text-xs">{sheet.name}</span>
                    )}
                    <div className="hidden group-hover:flex gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingSheetId(sheet.id); setEditingSheetName(sheet.name); }}
                        className="text-slate-600 hover:text-slate-300 px-0.5 text-xs"
                        title="Rename"
                      >✎</button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSheet(sheet.id); }}
                        className="text-slate-600 hover:text-red-400 px-0.5 text-xs"
                        title="Delete sheet"
                      >✕</button>
                    </div>
                  </div>
                ))}

                {/* Add sheet */}
                <div className="flex items-center gap-1 py-1">
                  <input
                    className="flex-1 bg-slate-800 text-slate-300 rounded px-1 text-xs border border-slate-700 focus:border-indigo-500 outline-none"
                    placeholder="New sheet…"
                    value={newSheetName}
                    onChange={e => setNewSheetName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        createSheet(newSheetName.trim() || `Sheet ${Object.keys(activeProject.sheets).length + 1}`);
                        setNewSheetName('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      createSheet(newSheetName.trim() || `Sheet ${Object.keys(activeProject.sheets).length + 1}`);
                      setNewSheetName('');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-xs px-1"
                  >+</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New project */}
      <div className="border-t border-slate-800 p-2 flex gap-1">
        <input
          className="flex-1 bg-slate-800 text-slate-300 rounded px-2 py-1 text-xs border border-slate-700 focus:border-indigo-500 outline-none"
          placeholder="New project…"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); }}
        />
        <button
          onClick={handleCreateProject}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2 py-1 text-xs"
        >+</button>
      </div>
    </div>
  );
}
