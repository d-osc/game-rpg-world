---
name: web-desktop-design
description: Design and build desktop-class web applications — window chrome, title bars, panels, toolbars, menus, sidebars, status bars, dialogs, split layouts, and native-feel UI patterns.
---

You are an expert in designing and building desktop-class web applications. When the user asks for help with desktop-style web UI, follow these instructions.

## Design Principles

- **Dense information** — desktop screens are large; use space efficiently, small padding, compact controls
- **Keyboard-first** — shortcuts, focus management, tab navigation, Enter/Escape handling
- **Resizable panels** — users expect to drag dividers, collapse sidebars, resize columns
- **Multi-window feel** — panels, tabs, split views within a single page
- **Right-click context** — custom context menus, not just clicks
- **State persistence** — remember sidebar width, panel collapse, sort order, scroll position
- **Instant feedback** — no loading spinners for local state; optimistic updates
- **Native feel** — system fonts, standard cursor, platform-aware spacing, subtle shadows

## Layout Architecture

### App Shell

```html
<div class="app">
  <header class="app-titlebar">
    <!-- Custom title bar -->
  </header>
  <div class="app-body">
    <aside class="app-sidebar">
      <!-- Navigation / file tree / tools -->
    </aside>
    <div class="app-resizer" data-direction="horizontal"></div>
    <main class="app-main">
      <!-- Primary content -->
    </main>
    <aside class="app-panel">
      <!-- Properties / inspector / details -->
    </aside>
  </div>
  <footer class="app-statusbar">
    <!-- Status info -->
  </footer>
</div>
```

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr;
  height: 100dvh;
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
}

.app-body {
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.app-sidebar {
  width: 240px;
  min-width: 180px;
  max-width: 400px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.app-main {
  flex: 1;
  overflow: auto;
  min-width: 0;
}

.app-panel {
  width: 280px;
  min-width: 200px;
  max-width: 450px;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  background: var(--surface);
}
```

### Resizable Divider

```css
.resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 150ms;
  flex-shrink: 0;
}
.resizer:hover,
.resizer.active {
  background: var(--accent);
}
```

```js
function initResizer(resizer, leftPanel, direction = 'horizontal') {
  let startPos, startSize;

  function onMouseDown(e) {
    startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize = direction === 'horizontal'
      ? leftPanel.offsetWidth
      : leftPanel.offsetHeight;
    resizer.classList.add('active');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function onMouseMove(e) {
    const current = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = current - startPos;
    const newSize = startSize + delta;
    const min = parseInt(getComputedStyle(leftPanel).minWidth) || 180;
    const max = parseInt(getComputedStyle(leftPanel).maxWidth) || 400;
    leftPanel.style.width = `${Math.min(max, Math.max(min, newSize))}px`;
  }

  function onMouseUp() {
    resizer.classList.remove('active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  resizer.addEventListener('mousedown', onMouseDown);
}
```

### Split Pane (Vertical)

```css
.split-vertical {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.split-vertical .split-top {
  flex: 1;
  overflow: auto;
  min-height: 100px;
}
.split-vertical .split-resizer {
  height: 4px;
  cursor: row-resize;
  flex-shrink: 0;
}
.split-vertical .split-bottom {
  height: 200px;
  min-height: 80px;
  overflow: auto;
}
```

## Window Chrome

### Custom Title Bar

```html
<header class="titlebar">
  <div class="titlebar-left">
    <img class="titlebar-icon" src="/favicon.svg" alt="" width="16" height="16">
    <span class="titlebar-title">App Name</span>
  </div>
  <div class="titlebar-center">
    <!-- Tabs or breadcrumb -->
    <nav class="titlebar-tabs">
      <button class="tab active" data-tab="dashboard">Dashboard</button>
      <button class="tab" data-tab="settings">Settings</button>
    </nav>
  </div>
  <div class="titlebar-right">
    <button class="titlebar-btn" aria-label="Minimize">
      <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button class="titlebar-btn" aria-label="Maximize">
      <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <button class="titlebar-btn titlebar-btn-close" aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
  </div>
</header>
```

```css
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 8px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  user-select: none;
  -webkit-app-region: drag;  /* Electron / Tauri draggable */
}

.titlebar-left,
.titlebar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.titlebar-icon { opacity: 0.7; }
.titlebar-title { font-weight: 600; font-size: 12px; opacity: 0.8; }

.titlebar-tabs {
  display: flex;
  gap: 2px;
}

.tab {
  padding: 4px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}
.tab:hover { background: var(--hover); }
.tab.active { background: var(--active); color: var(--text); font-weight: 500; }

.titlebar-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
}
.titlebar-btn:hover { background: var(--hover); }
.titlebar-btn-close:hover { background: #e81123; color: white; }
```

## Toolbar / Action Bar

```html
<div class="toolbar">
  <div class="toolbar-group">
    <button class="toolbar-btn" title="New File (Ctrl+N)">
      <svg><!-- icon --></svg>
    </button>
    <button class="toolbar-btn" title="Open (Ctrl+O)">
      <svg><!-- icon --></svg>
    </button>
    <button class="toolbar-btn" title="Save (Ctrl+S)">
      <svg><!-- icon --></svg>
    </button>
  </div>
  <div class="toolbar-separator"></div>
  <div class="toolbar-group">
    <button class="toolbar-btn" title="Undo (Ctrl+Z)">
      <svg><!-- icon --></svg>
    </button>
    <button class="toolbar-btn" title="Redo (Ctrl+Y)">
      <svg><!-- icon --></svg>
  </div>
  <div class="toolbar-separator"></div>
  <div class="toolbar-group">
    <button class="toolbar-btn active" title="Select">
      <svg><!-- icon --></svg>
    </button>
    <button class="toolbar-btn" title="Move">
      <svg><!-- icon --></svg>
    </button>
    <button class="toolbar-btn" title="Delete">
      <svg><!-- icon --></svg>
    </button>
  </div>
  <div class="toolbar-spacer"></div>
  <div class="toolbar-group">
    <input class="toolbar-search" type="search" placeholder="Search... (Ctrl+F)">
  </div>
</div>
```

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-spacer { flex: 1; }

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.toolbar-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
}
.toolbar-btn:hover { background: var(--hover); color: var(--text); }
.toolbar-btn.active { background: var(--active); color: var(--text); }

.toolbar-search {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  font-size: 12px;
  width: 200px;
  outline: none;
}
.toolbar-search:focus { border-color: var(--accent); }
```

## Sidebar Patterns

### File Tree / Navigation

```html
<nav class="sidebar-nav" aria-label="File explorer">
  <div class="sidebar-header">
    <span class="sidebar-label">Explorer</span>
    <button class="sidebar-action" title="New File">+</button>
  </div>
  <ul class="tree" role="tree">
    <li class="tree-item" role="treeitem" aria-expanded="true">
      <button class="tree-toggle">
        <svg class="tree-arrow" width="12" height="12"><!-- chevron --></svg>
        <svg class="tree-icon" width="14" height="14"><!-- folder icon --></svg>
        <span>src</span>
      </button>
      <ul class="tree-children" role="group">
        <li class="tree-item" role="treeitem">
          <button class="tree-leaf active">
            <svg class="tree-icon" width="14" height="14"><!-- file icon --></svg>
            <span>main.ts</span>
          </button>
        </li>
        <li class="tree-item" role="treeitem">
          <button class="tree-leaf">
            <svg class="tree-icon" width="14" height="14"><!-- file icon --></svg>
            <span>styles.css</span>
          </button>
        </li>
      </ul>
    </li>
  </ul>
</nav>
```

```css
.sidebar-nav {
  padding: 8px 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.sidebar-action {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 3px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 14px;
}
.sidebar-action:hover { background: var(--hover); }

.tree { list-style: none; padding: 0; }
.tree-children { padding-left: 16px; }

.tree-toggle,
.tree-leaf {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 3px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  text-align: left;
}
.tree-toggle:hover,
.tree-leaf:hover { background: var(--hover); }
.tree-leaf.active { background: var(--active); }

.tree-arrow {
  transition: transform 150ms;
  flex-shrink: 0;
}
.tree-item[aria-expanded="false"] .tree-arrow { transform: rotate(-90deg); }
.tree-item[aria-expanded="false"] > .tree-children { display: none; }
```

### Collapsible Sidebar

```css
.sidebar-collapsible {
  width: 240px;
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.sidebar-collapsible.collapsed {
  width: 48px;
}
.sidebar-collapsible.collapsed .sidebar-label,
.sidebar-collapsible.collapsed .tree-children,
.sidebar-collapsible.collapsed .tree-arrow {
  display: none;
}
```

## Context Menu

```js
function showContextMenu(e, items) {
  e.preventDefault();
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.role = 'menu';

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'context-menu-item';
    btn.role = 'menuitem';
    btn.innerHTML = `
      <span class="context-menu-icon">${item.icon || ''}</span>
      <span class="context-menu-label">${item.label}</span>
      ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
    `;
    if (item.disabled) btn.disabled = true;
    btn.onclick = () => { item.action?.(); menu.remove(); };
    menu.appendChild(btn);
  });

  // Position
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const x = Math.min(e.clientX, window.innerWidth - rect.width - 4);
  const y = Math.min(e.clientY, window.innerHeight - rect.height - 4);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // Dismiss
  const dismiss = (evt) => {
    if (!menu.contains(evt.target)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
  };
  setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', esc); }
  });
}
```

```css
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  font-size: 13px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.context-menu-item:hover:not(:disabled) { background: var(--accent); color: white; }
.context-menu-item:disabled { opacity: 0.4; cursor: default; }

.context-menu-icon { width: 16px; text-align: center; flex-shrink: 0; }
.context-menu-label { flex: 1; }
.context-menu-shortcut { color: var(--text-muted); font-size: 11px; margin-left: auto; }
.context-menu-item:hover .context-menu-shortcut { color: rgba(255,255,255,0.7); }

.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}
```

Usage:
```js
element.addEventListener('contextmenu', (e) => {
  showContextMenu(e, [
    { label: 'New File', icon: '📄', shortcut: 'Ctrl+N', action: () => newFile() },
    { label: 'New Folder', icon: '📁', action: () => newFolder() },
    { separator: true },
    { label: 'Rename', shortcut: 'F2', action: () => rename() },
    { label: 'Delete', shortcut: 'Del', action: () => deleteItem() },
    { separator: true },
    { label: 'Properties', shortcut: 'Alt+Enter', action: () => showProperties() },
  ]);
});
```

## Menu Bar

```html
<nav class="menubar" role="menubar">
  <div class="menubar-item" role="menuitem" tabindex="0">
    <span>File</span>
    <div class="menubar-dropdown" role="menu">
      <button class="menubar-option" role="menuitem">New <kbd>Ctrl+N</kbd></button>
      <button class="menubar-option" role="menuitem">Open <kbd>Ctrl+O</kbd></button>
      <button class="menubar-option" role="menuitem">Save <kbd>Ctrl+S</kbd></button>
      <div class="menubar-separator"></div>
      <button class="menubar-option" role="menuitem">Exit <kbd>Alt+F4</kbd></button>
    </div>
  </div>
  <div class="menubar-item" role="menuitem" tabindex="0">
    <span>Edit</span>
    <div class="menubar-dropdown" role="menu">
      <button class="menubar-option" role="menuitem">Undo <kbd>Ctrl+Z</kbd></button>
      <button class="menubar-option" role="menuitem">Redo <kbd>Ctrl+Y</kbd></button>
      <div class="menubar-separator"></div>
      <button class="menubar-option" role="menuitem">Cut <kbd>Ctrl+X</kbd></button>
      <button class="menubar-option" role="menuitem">Copy <kbd>Ctrl+C</kbd></button>
      <button class="menubar-option" role="menuitem">Paste <kbd>Ctrl+V</kbd></button>
    </div>
  </div>
  <div class="menubar-item" role="menuitem" tabindex="0">
    <span>View</span>
    <div class="menubar-dropdown" role="menu">
      <button class="menubar-option" role="menuitem">Toggle Sidebar <kbd>Ctrl+B</kbd></button>
      <button class="menubar-option" role="menuitem">Toggle Panel <kbd>Ctrl+J</kbd></button>
      <button class="menubar-option" role="menuitem">Full Screen <kbd>F11</kbd></button>
    </div>
  </div>
</nav>
```

```css
.menubar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 4px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  user-select: none;
}

.menubar-item {
  position: relative;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.menubar-item:hover,
.menubar-item.open { background: var(--hover); }

.menubar-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  z-index: 100;
}
.menubar-item.open > .menubar-dropdown { display: block; }

.menubar-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.menubar-option:hover { background: var(--accent); color: white; }
.menubar-option kbd { font-size: 11px; color: var(--text-muted); font-family: inherit; }
.menubar-option:hover kbd { color: rgba(255,255,255,0.7); }

.menubar-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}
```

## Status Bar

```html
<footer class="statusbar">
  <div class="statusbar-left">
    <span class="statusbar-item">
      <span class="status-indicator online"></span>
      Connected
    </span>
    <span class="statusbar-item">Branch: main</span>
  </div>
  <div class="statusbar-right">
    <span class="statusbar-item">Ln 42, Col 18</span>
    <span class="statusbar-item">UTF-8</span>
    <span class="statusbar-item">TypeScript</span>
    <span class="statusbar-item clickable">Spaces: 2</span>
  </div>
</footer>
```

```css
.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: var(--accent);
  color: white;
  font-size: 12px;
  user-select: none;
}

.statusbar-left,
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.statusbar-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.statusbar-item.clickable {
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
}
.statusbar-item.clickable:hover { background: rgba(255,255,255,0.15); }

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
}
.status-indicator.offline { background: #f87171; }
.status-indicator.syncing { background: #facc15; animation: pulse 1.5s infinite; }

@keyframes pulse { 50% { opacity: 0.5; } }
```

## Dialog / Modal

```html
<dialog class="dialog" id="confirm-dialog">
  <div class="dialog-header">
    <h2 class="dialog-title">Confirm Delete</h2>
    <button class="dialog-close" aria-label="Close">&times;</button>
  </div>
  <div class="dialog-body">
    <p>Are you sure you want to delete this item? This action cannot be undone.</p>
  </div>
  <div class="dialog-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-danger">Delete</button>
  </div>
</dialog>
```

```css
.dialog {
  position: fixed;
  inset: 0;
  width: max-content;
  max-width: min(480px, 90vw);
  margin: auto;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  background: var(--surface);
  color: var(--text);
}
.dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.dialog-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.dialog-close:hover { background: var(--hover); color: var(--text); }

.dialog-body {
  padding: 20px;
  font-size: 13px;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
```

```js
// Open dialog
document.getElementById('confirm-dialog').showModal();

// Close
document.querySelector('.dialog-close').onclick = () => dialog.close();
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();  // click backdrop to close
});
```

## Data Table

```html
<div class="table-container">
  <table class="data-table">
    <thead>
      <tr>
        <th class="th-sortable" data-sort="name">
          Name <span class="sort-icon">↕</span>
        </th>
        <th class="th-sortable" data-sort="size">
          Size <span class="sort-icon">↕</span>
        </th>
        <th class="th-sortable" data-sort="modified">
          Modified <span class="sort-icon">↕</span>
        </th>
        <th class="th-actions"></th>
      </tr>
    </thead>
    <tbody>
      <tr class="data-row" tabindex="0">
        <td><span class="file-icon">📄</span> main.ts</td>
        <td class="td-num">2.4 KB</td>
        <td>2 hours ago</td>
        <td>
          <button class="row-action" title="More actions">⋮</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

```css
.table-container {
  overflow: auto;
  flex: 1;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  white-space: nowrap;
}

.data-table th {
  position: sticky;
  top: 0;
  text-align: left;
  padding: 6px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-weight: 500;
  font-size: 12px;
  color: var(--text-muted);
  user-select: none;
}

.th-sortable { cursor: pointer; }
.th-sortable:hover { color: var(--text); }
.sort-icon { opacity: 0.4; font-size: 10px; }

.data-table td {
  padding: 5px 12px;
  border-bottom: 1px solid var(--border);
}

.data-row {
  cursor: pointer;
  transition: background 80ms;
}
.data-row:hover { background: var(--hover); }
.data-row.selected { background: var(--active); }

.td-num { text-align: right; font-variant-numeric: tabular-nums; }

.th-actions { width: 40px; }

.row-action {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  font-size: 16px;
}
.data-row:hover .row-action { opacity: 1; }
.row-action:hover { background: var(--hover); }
```

## Command Palette (Ctrl+K)

```html
<dialog class="command-palette" id="cmd-palette">
  <div class="cmd-input-wrap">
    <svg class="cmd-icon" width="16" height="16"><!-- search --></svg>
    <input class="cmd-input" type="text" placeholder="Type a command or search..." autofocus>
    <kbd class="cmd-esc">Esc</kbd>
  </div>
  <ul class="cmd-list">
    <li class="cmd-item active">
      <span class="cmd-item-icon">📄</span>
      <span class="cmd-item-label">New File</span>
      <kbd class="cmd-item-shortcut">Ctrl+N</kbd>
    </li>
    <li class="cmd-item">
      <span class="cmd-item-icon">📂</span>
      <span class="cmd-item-label">Open Folder</span>
      <kbd class="cmd-item-shortcut">Ctrl+O</kbd>
    </li>
    <li class="cmd-item">
      <span class="cmd-item-icon">🔍</span>
      <span class="cmd-item-label">Find in Files</span>
      <kbd class="cmd-item-shortcut">Ctrl+Shift+F</kbd>
    </li>
  </ul>
  <div class="cmd-footer">
    <span><kbd>↑↓</kbd> navigate</span>
    <span><kbd>Enter</kbd> select</span>
    <span><kbd>Esc</kbd> close</span>
  </div>
</dialog>
```

```css
.command-palette {
  position: fixed;
  inset: 0;
  width: max-content;
  max-width: min(560px, 90vw);
  max-height: 420px;
  margin: 15vh auto auto;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  background: var(--surface);
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.cmd-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--text);
  outline: none;
}
.cmd-esc {
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
}

.cmd-list {
  list-style: none;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.cmd-item:hover,
.cmd-item.active { background: var(--hover); }
.cmd-item.active { background: var(--accent); color: white; }

.cmd-item-icon { width: 20px; text-align: center; }
.cmd-item-label { flex: 1; }
.cmd-item-shortcut {
  font-size: 11px;
  color: var(--text-muted);
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: inherit;
}
.cmd-item.active .cmd-item-shortcut { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.3); }

.cmd-footer {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
}
.cmd-footer kbd {
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: inherit;
}
```

## Keyboard Shortcuts

```js
const shortcuts = new Map();

function registerShortcut(key, description, action) {
  shortcuts.set(key.toLowerCase(), { description, action });
}

function handleShortcut(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  const combo = parts.join('+');

  const shortcut = shortcuts.get(combo);
  if (shortcut) {
    e.preventDefault();
    shortcut.action();
  }
}

document.addEventListener('keydown', handleShortcut);

// Register common desktop shortcuts
registerShortcut('ctrl+k', 'Command palette', () => document.getElementById('cmd-palette')?.showModal());
registerShortcut('ctrl+s', 'Save', () => save());
registerShortcut('ctrl+z', 'Undo', () => undo());
registerShortcut('ctrl+y', 'Redo', () => redo());
registerShortcut('ctrl+f', 'Find', () => focusSearch());
registerShortcut('ctrl+b', 'Toggle sidebar', () => toggleSidebar());
registerShortcut('ctrl+n', 'New file', () => newFile());
registerShortcut('ctrl+,', 'Settings', () => openSettings());
registerShortcut('escape', 'Close / Cancel', () => closeTopDialog());
```

## Design Tokens

```css
:root {
  /* Surfaces */
  --bg: #ffffff;
  --surface: #f8f9fa;
  --surface-raised: #ffffff;
  --hover: rgba(0, 0, 0, 0.05);
  --active: rgba(0, 0, 0, 0.08);
  --border: #e0e0e0;
  --border-focus: #3b82f6;

  /* Text */
  --text: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;

  /* Accent */
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --accent-text: #ffffff;

  /* Danger */
  --danger: #ef4444;
  --danger-hover: #dc2626;

  /* Sizing */
  --titlebar-h: 38px;
  --toolbar-h: 38px;
  --statusbar-h: 24px;
  --menubar-h: 28px;
  --sidebar-w: 240px;
  --panel-w: 280px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Font */
  --font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
  --font-size: 13px;

  /* Timing */
  --fast: 80ms;
  --normal: 150ms;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --surface: #252526;
    --surface-raised: #2d2d2d;
    --hover: rgba(255, 255, 255, 0.08);
    --active: rgba(255, 255, 255, 0.12);
    --border: #3e3e3e;
    --text: #cccccc;
    --text-secondary: #999999;
    --text-muted: #666666;
  }
}
```

## Common App Layouts

### IDE Layout (VS Code style)

```
┌─ Title Bar ──────────────────────────────────────┐
│ Menu Bar                                          │
├────────┬──────────────────────────┬──────────────┤
│        │ Tabs                     │              │
│ Side   │ Toolbar                  │  Panel       │
│ bar    │───────────────────────── │  (Props /    │
│ (Tree) │                          │   Output /   │
│        │ Editor                   │   Terminal)  │
│        │                          │              │
├────────┴──────────────────────────┴──────────────┤
│ Status Bar                                        │
└───────────────────────────────────────────────────┘
```

### Dashboard Layout

```
┌─ Header (Logo, Nav, User) ───────────────────────┐
├────────┬──────────────────────────────────────────┤
│        │ Breadcrumb                                │
│ Side   │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ nav    │ │ Stat │ │ Stat │ │ Stat │ │ Stat │    │
│        │ └──────┘ └──────┘ └──────┘ └──────┘    │
│        │ ┌───────────────────┐ ┌────────────┐    │
│        │ │ Chart             │ │ Activity    │    │
│        │ │                   │ │             │    │
│        │ └───────────────────┘ └────────────┘    │
├────────┴──────────────────────────────────────────┤
```

### File Manager Layout

```
┌─ Toolbar (Back, Forward, Path, Search) ──────────┐
├────────┬──────────────────────────────────────────┤
│ Tree   │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│        │ │ 📄   │ │ 📁   │ │ 📄   │ │ 📄   │    │
│        │ │ file │ │ dir  │ │ file │ │ file │    │
│        │ └──────┘ └──────┘ └──────┘ └──────┘    │
│        │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│        │ │ ...  │ │ ...  │ │ ...  │ │ ...  │    │
│        │ └──────┘ └──────┘ └──────┘ └──────┘    │
├────────┴──────────────────────────────────────────┤
│ 12 items │ 2.4 GB free                            │
└───────────────────────────────────────────────────┘
```

## Code Style Rules

- Use `13px` as base font size for desktop apps (not 16px — desktop UI is denser).
- Use system font stack (`system-ui`, `Segoe UI`) for native feel.
- Use `8px` grid for spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- Use `100dvh` for full viewport height; never rely on `100vh` alone.
- Use `position: sticky` for table headers and toolbar.
- Every interactive element must be keyboard accessible with visible `:focus-visible`.
- Use `<dialog>` for modals — it handles focus trap, Escape, and backdrop natively.
- Use `role="tree"` and `aria-expanded` for file trees and navigation.
- Use `kbd` elements to display keyboard shortcuts.
- Use `overflow: hidden` on app shell; scroll within panels only.
- Use `min-width`/`max-width` on resizable panels to prevent collapse.
- Use CSS custom properties for all design tokens; support dark mode via `prefers-color-scheme`.
- Use `user-select: none` on title bars, toolbars, and tree items.
- Register keyboard shortcuts with `Ctrl`/`Cmd` + key. Show shortcuts in UI with `kbd` tags.
- Always show loading states for async data; prefer skeleton over spinner.
