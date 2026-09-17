(function () {
  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  window.CGAdmin = {
    escapeHtml: escapeHtml,

    async fetchAdmin(url, options) {
      const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
      if (res.status === 401) {
        window.location.href = '/admin/login';
        throw new Error('Unauthorized');
      }
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
      return data;
    },

    formatMoney(cents, currency) {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format((cents || 0) / 100);
    },

    formatDate(value) {
      if (!value) return '—';
      return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    statusBadge(invoice) {
      if (invoice.status === 'sent' && invoice.is_overdue) {
        return '<span class="badge badge-overdue">Overdue</span>';
      }
      const labels = { draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void' };
      return `<span class="badge badge-${invoice.status}">${labels[invoice.status] || invoice.status}</span>`;
    }
  };

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      fetch('/api/admin/logout', { method: 'POST' }).finally(function () {
        window.location.href = '/admin/login';
      });
    });
  }
})();
