/**
 * Popup App — Safari fallback.
 *
 * Re-exports the Side Panel App component so that the popup uses the
 * exact same UI.  Safari lacks both `sidePanel` and `sidebarAction` APIs,
 * so the popup serves as the primary UI surface on that browser.
 */
import App from '../sidepanel/App';

export default App;
