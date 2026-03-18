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

    if (typeof html2pdf !== 'function') {
      alert('PDF library failed to load. Please check your internet connection and refresh the page.');
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

    // Clone into a container directly on <body> so no parent overflow:hidden
    // can crop the left/right edges of the 794px A4 canvas during capture.
    const clone = previewEl.cloneNode(true);
    clone.style.cssText = [
      'width:794px',
      'min-height:1123px',
      'transform:none',
      'transform-origin:top left',
      'margin:0',
      'padding:0',
      'box-shadow:none',
      'border-radius:0',
      'overflow:visible',
      'position:absolute',
      'top:0',
      'left:-9999px',
      'background:#fff',
    ].join(';');
    document.body.appendChild(clone);

    // Force reflow so scrollHeight is accurate.
    void clone.offsetHeight;

    const contentHeightPx = clone.scrollHeight;
    const a4HeightMm      = (contentHeightPx / 794) * 210;

    function restore() {
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      btn.innerHTML = orig;
      btn.disabled  = false;
    }

    html2pdf()
      .set({
        margin:      0,
        filename:    filename,
        image:       { type: 'jpeg', quality: 1.0 },
        html2canvas: {
          scale:       2,
          useCORS:     true,
          logging:     false,
          windowWidth: 794,
          width:       794,
          scrollX:     0,
          scrollY:     0,
        },
        jsPDF: {
          unit:        'mm',
          format:      [210, Math.max(297, a4HeightMm)],
          orientation: 'portrait',
          compress:    true,
        },
      })
      .from(clone)
      .save()
      .then(() => {
        restore();
        if (typeof showToast === 'function') showToast('PDF downloaded!', 'success');
      })
      .catch(err => {
        console.error('PDF generation error:', err);
        restore();
        if (typeof showToast === 'function') showToast('PDF generation failed. Please try again.', 'error');
      });
  });
});
