export const SHORTCUTS = [
  { keys: '?', action: 'Open settings and this help' },
  { keys: 'Esc', action: 'Cancel drawing or close dialog' },
  { keys: 'Enter', action: 'Finish route or save edits' },
  { keys: 'Backspace / Delete', action: 'Undo last point, or delete selected vertex' },
  { keys: 'Ctrl/⌘ Z', action: 'Undo last point' },
  { keys: 'Shift + click', action: 'Add a vertex while editing' },
  { keys: 'Add / Delete point', action: 'Insert or remove after the selected vertex' },
  { keys: 'Split here', action: 'Split the edited route at the selected vertex' },
];

export function ShortcutsList() {
  return (
    <ul className="shortcuts-help__list">
      {SHORTCUTS.map((item) => (
        <li key={item.keys}>
          <kbd>{item.keys}</kbd>
          <span>{item.action}</span>
        </li>
      ))}
    </ul>
  );
}
