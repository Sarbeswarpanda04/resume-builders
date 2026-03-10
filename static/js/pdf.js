/**
 * pdf.js — Smart Resume Builder
 * Handles PDF download using html2pdf.js.
 * Attached to the "Download PDF" button on the main builder page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('download-btn');
  if (!downloadBtn) return;

  // ── A4 scale-to-fit for the side pane ────────────────────────────────────
  const wrapper = document.getElementById('preview-zoom-target');
  const previewEl = document.getElementById('resume-preview');
  const A4_WIDTH = 794;

  function fitPreviewToPane() {
    if (!wrapper || !previewEl) return;
    // Available width = wrapper width minus padding (2 × 1rem = 32px)
    const availableWidth = wrapper.clientWidth - 32;
    const scale = Math.min(1, availableWidth / A4_WIDTH);
    previewEl.style.setProperty('--preview-scale', scale);
    // Pull the element up so the white-space below the scaled canvas is removed
    previewEl.style.marginBottom = `${(scale - 1) * 1123}px`;
    previewEl.style.transform = `scale(${scale})`;
    previewEl.style.transformOrigin = 'top center';
  }

  fitPreviewToPane();
  window.addEventListener('resize', fitPreviewToPane);

  // Zoom controls now adjust scale relatively
  let zoomOffset = 0;
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    zoomOffset = Math.min(zoomOffset + 0.05, 0.3);
    if (!wrapper || !previewEl) return;
    const availableWidth = wrapper.clientWidth - 32;
    const base = Math.min(1, availableWidth / A4_WIDTH);
    const scale = Math.min(1, base + zoomOffset);
    previewEl.style.transform = `scale(${scale})`;
    previewEl.style.marginBottom = `${(scale - 1) * 1123}px`;
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    zoomOffset = Math.max(zoomOffset - 0.05, -0.2);
    if (!wrapper || !previewEl) return;
    const availableWidth = wrapper.clientWidth - 32;
    const base = Math.min(1, availableWidth / A4_WIDTH);
    const scale = Math.max(0.2, base + zoomOffset);
    previewEl.style.transform = `scale(${scale})`;
    previewEl.style.marginBottom = `${(scale - 1) * 1123}px`;
  });

  downloadBtn.addEventListener('click', () => {
    if (!previewEl) return;

    // Guard: nothing to export yet
    const placeholder = previewEl.querySelector('.preview-placeholder');
    if (placeholder) {
      alert('Please fill in your resume details before downloading.');
      return;
    }

    const nameEl = previewEl.querySelector('.preview-name');
    const filename = nameEl?.textContent
      ? `${nameEl.textContent.trim().replace(/\s+/g, '_')}_Resume.pdf`
      : 'Resume.pdf';

    const btn = document.getElementById('download-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
    btn.disabled = true;

    // Temporarily render at full A4 size for html2canvas
    const savedTransform = previewEl.style.transform;
    const savedMargin    = previewEl.style.marginBottom;
    previewEl.style.transform    = 'scale(1)';
    previewEl.style.transformOrigin = 'top left';
    previewEl.style.marginBottom = '0';
    previewEl.style.boxShadow    = 'none';
    previewEl.style.borderRadius = '0';

    function restore() {
      previewEl.style.transform       = savedTransform;
      previewEl.style.transformOrigin = 'top center';
      previewEl.style.marginBottom    = savedMargin;
      previewEl.style.boxShadow       = '';
      previewEl.style.borderRadius    = '';
      btn.innerHTML = orig;
      btn.disabled  = false;
    }

    html2pdf()
      .set({
        margin:      [8, 8, 8, 8],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 794 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(previewEl)
      .save()
      .then(() => {
        restore();
        if (typeof showToast === 'function') showToast('PDF downloaded!', 'success');
      })
      .catch(() => {
        restore();
        if (typeof showToast === 'function') showToast('PDF generation failed.', 'error');
      });
  });
});
