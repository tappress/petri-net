import { useState } from 'react';
import { useProjectStore, selectActiveProject } from '@/store/projectStore';
import type { Project } from '@/types/petri';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function parseProject(text: string): Project | null {
  try {
    const proj = JSON.parse(text) as Project;
    if (!proj.id || !proj.name || !proj.sheets) return null;
    return proj;
  } catch {
    return null;
  }
}

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
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreateProject = () => {
    const name = newProjectName.trim() || `Project ${Object.keys(projects).length + 1}`;
    createProject(name);
    setNewProjectName('');
  };

  const doImport = (proj: Project) => {
    proj.id = nanoid();
    importProject(proj);
  };

  const handleExportJson = (project: Project) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.petri.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = async (project: Project) => {
    await navigator.clipboard.writeText(JSON.stringify(project, null, 2));
    setCopied(project.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const proj = parseProject(ev.target?.result as string);
        if (proj) doImport(proj);
        else alert('Invalid Petri net JSON file');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handlePasteImport = () => {
    const proj = parseProject(pasteText);
    if (!proj) { setPasteError(true); return; }
    setPasteError(false);
    setPasteText('');
    doImport(proj);
  };

  return (
    <div className="w-60 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <span className="text-sm font-semibold text-foreground">Projects</span>
      </div>

      {/* Import buttons */}
      <div className="px-2 py-2 flex gap-1.5 border-b border-sidebar-border">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleImportFile}>
          ↑ File
        </Button>
        <Button
          variant="outline" size="sm"
          className={cn('flex-1 h-8 text-xs gap-1', pasteText && 'border-primary')}
          onClick={handlePasteImport}
          disabled={!pasteText.trim()}
          title="Import from pasted JSON"
        >
          ⎘ Paste
        </Button>
      </div>

      {/* Paste JSON area */}
      <div className="px-2 pb-2 border-b border-sidebar-border">
        <textarea
          className={cn(
            'w-full h-16 text-xs rounded border px-2 py-1.5 font-mono resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            pasteError ? 'border-destructive' : 'border-input'
          )}
          placeholder="Paste JSON here…"
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setPasteError(false); }}
          spellCheck={false}
        />
        {pasteError && <p className="text-xs text-destructive mt-0.5">Invalid Petri net JSON</p>}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {Object.values(projects).map(proj => (
            <div key={proj.id}>
              {/* Project row */}
              <div
                className={cn(
                  'group flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-sm mx-1 transition-colors',
                  proj.id === activeProjectId
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
                onClick={() => setActiveProject(proj.id)}
              >
                {editingProjectId === proj.id ? (
                  <Input
                    autoFocus
                    className="h-5 text-xs px-1 py-0"
                    value={editingProjectName}
                    onChange={e => setEditingProjectName(e.target.value)}
                    onBlur={() => { renameProject(proj.id, editingProjectName); setEditingProjectId(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { renameProject(proj.id, editingProjectName); setEditingProjectId(null); }
                      e.stopPropagation();
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-xs">{proj.name}</span>
                )}
                <div className="hidden group-hover:flex gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingProjectId(proj.id); setEditingProjectName(proj.name); }}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded text-xs leading-none" title="Rename"
                  >✎</button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Delete "${proj.name}"?`)) deleteProject(proj.id); }}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded text-xs leading-none" title="Delete"
                  >✕</button>
                </div>
              </div>

              {/* Export buttons — shown for active project */}
              {proj.id === activeProjectId && (
                <div className="mx-2 mb-1 flex gap-1">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={e => { e.stopPropagation(); handleExportJson(proj); }}
                    title="Download as .petri.json"
                  >
                    ↓ JSON
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className={cn(
                      'flex-1 h-7 text-xs gap-1',
                      copied === proj.id ? 'border-green-500 text-green-700' : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={e => { e.stopPropagation(); handleCopyClipboard(proj); }}
                    title="Copy JSON to clipboard"
                  >
                    {copied === proj.id ? '✓ Copied' : '⎘ Copy'}
                  </Button>
                </div>
              )}

              {/* Sheets for active project */}
              {proj.id === activeProjectId && activeProject && (
                <div className="ml-4 border-l border-border pl-2 mb-1 mt-0.5 space-y-0.5">
                  {Object.values(activeProject.sheets).map(sheet => (
                    <div
                      key={sheet.id}
                      className={cn(
                        'group flex items-center gap-1 py-1 px-1.5 cursor-pointer rounded text-xs transition-colors',
                        sheet.id === activeProject.activeSheetId
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                      onClick={() => setActiveSheet(sheet.id)}
                    >
                      {editingSheetId === sheet.id ? (
                        <Input
                          autoFocus
                          className="h-5 text-xs px-1 py-0"
                          value={editingSheetName}
                          onChange={e => setEditingSheetName(e.target.value)}
                          onBlur={() => { renameSheet(sheet.id, editingSheetName); setEditingSheetId(null); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { renameSheet(sheet.id, editingSheetName); setEditingSheetId(null); }
                            e.stopPropagation();
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate">{sheet.name}</span>
                      )}
                      <div className="hidden group-hover:flex gap-0.5">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingSheetId(sheet.id); setEditingSheetName(sheet.name); }}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded text-xs leading-none"
                        >✎</button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteSheet(sheet.id); }}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded text-xs leading-none"
                        >✕</button>
                      </div>
                    </div>
                  ))}

                  {/* Add sheet */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <Input
                      className="h-6 text-xs px-1.5"
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
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        createSheet(newSheetName.trim() || `Sheet ${Object.keys(activeProject.sheets).length + 1}`);
                        setNewSheetName('');
                      }}>+</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* New project */}
      <Separator />
      <div className="p-2 flex gap-1.5">
        <Input
          className="h-7 text-xs"
          placeholder="New project…"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); }}
        />
        <Button size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleCreateProject}>+</Button>
      </div>
    </div>
  );
}
