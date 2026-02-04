// Tab switching UI

export function initTabs() {
  document.querySelectorAll('.tab-bar .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

export function switchTab(tabName) {
  // Update button active states
  document.querySelectorAll('.tab-bar .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Show/hide tab content panels
  document.querySelectorAll('.tab-content').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`);
  });
}

export function updateTabBadge(count) {
  const badge = document.getElementById('tab-rule-count');
  if (badge) {
    badge.textContent = count > 0 ? `(${count})` : '';
  }
}
